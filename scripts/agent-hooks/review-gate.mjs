#!/usr/bin/env node
// @ts-check
// Entry for the pre-PR review gate hook. See docs/agents/git-and-prs.md.
// Usage: node review-gate.mjs --agent=<claude|codex|gemini|cursor|copilot>
//
// Stdin that does not parse passes through, so a broken hook never locks an
// agent out of the shell. Once a call is known to open a PR, any error
// blocks it.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  REVIEWERS,
  TOOLS,
  branchRefsOf,
  countsAsRun,
  decidePr,
  decideReviewerStart,
  handbackReport,
  isMcpCreatePr,
  isReport,
  isReviewer,
  prCommandsOf,
  reviewersWithoutRun,
} from './review-gate-policy.mjs';
import { findBypass } from './review-gate-bypass.mjs';
import { isAbsolutePath, quoteArgv, shellScriptOf } from './shell-parse.mjs';

/** @typedef {import('./review-gate-policy.mjs').PrCall} PrCall */
/** @typedef {import('./review-gate-policy.mjs').PrCommand} PrCommand */
/** @typedef {keyof typeof TOOLS} ToolName */

/**
 * @typedef {PrCall
 *   | { kind: 'agent-start', input: Record<string, unknown> }
 *   | { kind: 'agent-stop', agent: unknown, output: unknown, transcript: unknown }
 *   | { kind: 'other' }} Call
 * @typedef {{ toCall: (event: any) => Call, deny: (message: string) => never }} Adapter
 */

// ---- Tool adapters ----

/** @param {unknown} value */
function parseJson(value) {
  if (typeof value !== 'string') return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

// Codex has sent shell commands as argv arrays.
/** @param {unknown} command */
function commandText(command) {
  if (typeof command === 'string') return command;
  if (!Array.isArray(command)) return '';
  const argv = command.map(String);
  return shellScriptOf(argv) ?? quoteArgv(argv);
}

/**
 * @param {ToolName} tool
 * @param {unknown} name
 * @param {any} input
 * @returns {Call}
 */
function toolCall(tool, name, input) {
  if (typeof name !== 'string') return { kind: 'other' };
  if (isMcpCreatePr(name)) return { kind: 'mcp', input: input ?? {} };
  const shellTools = /** @type {readonly string[]} */ (TOOLS[tool].shellTools);
  if (shellTools.includes(name)) return { kind: 'shell', command: commandText(input?.command) };
  return { kind: 'other' };
}

/** @param {string} message @returns {never} */
function exitDeny(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

/** @param {object} output @returns {never} */
function jsonDeny(output) {
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

/** @type {Record<ToolName, Adapter>} */
const ADAPTERS = {
  claude: {
    toCall(event) {
      if (event.hook_event_name === 'SubagentStop') {
        return {
          kind: 'agent-stop',
          agent: event.agent_type,
          output: event.last_assistant_message,
          transcript: event.agent_transcript_path,
        };
      }
      if (event.tool_name === 'Agent' || event.tool_name === 'Task') {
        return { kind: 'agent-start', input: event.tool_input ?? {} };
      }
      return toolCall('claude', event.tool_name, event.tool_input);
    },
    deny: exitDeny,
  },
  codex: {
    toCall: (event) => toolCall('codex', event.tool_name, event.tool_input),
    deny: exitDeny,
  },
  gemini: {
    toCall: (event) => toolCall('gemini', event.tool_name, event.tool_input),
    deny: exitDeny,
  },
  cursor: {
    toCall: (event) =>
      event.tool_name
        ? toolCall('cursor', event.tool_name, parseJson(event.tool_input))
        : { kind: 'shell', command: commandText(event.command) },
    deny: (message) =>
      jsonDeny({
        permission: 'deny',
        user_message: message,
        agent_message: message,
      }),
  },
  copilot: {
    toCall: (event) => toolCall('copilot', event.toolName, parseJson(event.toolArgs)),
    deny: (message) =>
      jsonDeny({
        permissionDecision: 'deny',
        permissionDecisionReason: message,
      }),
  },
};

// ---- Git ----

/** @param {string} cwd @param {string[]} args */
function tryGit(cwd, ...args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** @param {string} cwd @param {string} ref */
function commitOf(cwd, ref) {
  return tryGit(cwd, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
}

/** @param {string} cwd */
function currentBranch(cwd) {
  return tryGit(cwd, 'symbolic-ref', '--quiet', '--short', 'HEAD') || null;
}

// ---- Reviewer runs ----
//
// One file per reviewer, at .git/review-gate/<branch>/<agent>.json, written
// through a rename, so reviewers that finish at once do not overwrite each
// other.

/** @param {string} cwd @param {string} branch */
function runsDir(cwd, branch) {
  const gitDir = tryGit(cwd, 'rev-parse', '--git-common-dir');
  return gitDir && join(resolve(cwd, gitDir), 'review-gate', encodeURIComponent(branch));
}

/** @param {string} cwd @param {string} branch */
function readRuns(cwd, branch) {
  const dir = runsDir(cwd, branch);
  /** @type {Record<string, { head?: string }>} */
  const runs = {};
  for (const { agent } of REVIEWERS) {
    try {
      if (dir) runs[agent] = JSON.parse(readFileSync(join(dir, `${agent}.json`), 'utf8'));
    } catch {
      // No run yet.
    }
  }
  return runs;
}

/**
 * Records a reviewer's run when it returned a report. A background
 * subagent's report is in its transcript, not in `last_assistant_message`,
 * so the transcript is read only for a reviewer with no last message.
 * @param {string} cwd @param {unknown} agent @param {unknown} output @param {unknown} transcript
 */
function recordRun(cwd, agent, output, transcript) {
  if (!isReviewer(agent)) return;
  const text =
    isReport(output) || typeof transcript !== 'string'
      ? null
      : readFile(isAbsolutePath(transcript) ? transcript : resolve(cwd, transcript));
  const report = text === null ? output : handbackReport(text);
  if (!countsAsRun(agent, report)) return;
  const branch = currentBranch(cwd);
  const head = tryGit(cwd, 'rev-parse', 'HEAD');
  const dir = branch && runsDir(cwd, branch);
  if (!dir || !head) return;
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${agent}.json`);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ head, at: new Date().toISOString() }, null, 2)}\n`);
  renameSync(temp, file);
}

/** @param {PrCommand} pr @param {string} cwd */
function reviewersNotRun(pr, cwd) {
  const { head, baseRefs } = branchRefsOf(pr);
  const branch = head ?? currentBranch(cwd);
  return reviewersWithoutRun(branch ? readRuns(cwd, branch) : {}, {
    head: branch && commitOf(cwd, branch),
    base: baseRefs.map((ref) => commitOf(cwd, ref)).find(Boolean) ?? null,
    isAncestor: (commit, of) => tryGit(cwd, 'merge-base', '--is-ancestor', commit, of) !== null,
  });
}

// ---- Main ----

/**
 * Reads `path`, an absolute or `~` path, or null when it is missing.
 * @param {string} path
 */
function readFile(path) {
  try {
    return readFileSync(path.replace(/^~(?=\/|$)/, homedir()), 'utf8');
  } catch {
    return null;
  }
}

/** @param {Adapter} adapter @param {string} message @returns {never} */
function block(adapter, message) {
  return adapter.deny(`Blocked by the review gate. ${message}`);
}

/** @param {PrCommand} pr @param {string} cwd @param {ToolName} tool */
function checkPr(pr, cwd, tool) {
  const refs = branchRefsOf(pr);
  const dir = refs.dir === null ? null : resolve(cwd, refs.dir);
  // The folder to read a relative path and the reviewer runs from. decidePr
  // refuses before it needs one the parser could not tell; never fall back
  // to the hook's own (#472).
  const inDir = () => {
    if (dir === null) throw new Error('no folder is known for this PR command');
    return dir;
  };
  let decision;
  try {
    decision = decidePr(pr, {
      // inDir runs only for a relative path, after decidePr ruled out a null folder.
      readFile: (path) => readFile(isAbsolutePath(path) ? path : resolve(inDir(), path)),
      reviewersNotRun: () => (TOOLS[tool].tracksReviewers ? reviewersNotRun(pr, inDir()) : []),
    });
  } catch (error) {
    decision = {
      deny: `The hook failed: ${error instanceof Error ? error.message : error}.`,
    };
  }
  if (decision) block(ADAPTERS[tool], decision.deny);
}

/** @param {string} name @returns {name is ToolName} */
function isTool(name) {
  return Object.hasOwn(TOOLS, name);
}

function main() {
  const flag = '--agent=';
  const tool = (process.argv.find((arg) => arg.startsWith(flag)) ?? '').slice(flag.length);
  if (!isTool(tool)) {
    process.stderr.write(
      `review-gate: unknown --agent "${tool}". Use one of: ${Object.keys(TOOLS).join(', ')}.\n`,
    );
    process.exit(1);
  }
  const adapter = ADAPTERS[tool];

  let event;
  try {
    event = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  if (!event || typeof event !== 'object') return;
  const cwd = typeof event.cwd === 'string' ? event.cwd : process.cwd();
  const call = adapter.toCall(event);

  if (call.kind === 'agent-start') {
    const decision = decideReviewerStart(call.input);
    if (decision) block(adapter, decision.deny);
  } else if (call.kind === 'agent-stop') {
    recordRun(cwd, call.agent, call.output, call.transcript);
  } else if (call.kind === 'shell' || call.kind === 'mcp') {
    if (call.kind === 'shell') {
      // A merge that bypasses branch protection, or a gh word or endpoint the
      // hook cannot read that may hide a PR open or merge, is refused
      // whatever the PR body says.
      const bypass = findBypass(call.command);
      if (bypass) block(adapter, bypass);
    }
    for (const pr of prCommandsOf(call)) checkPr(pr, cwd, tool);
  }
}

main();
