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
  isMcpCreatePr,
  prCommandsOf,
  reviewersWithoutRun,
} from './review-gate-policy.mjs';
import { quoteArgv, shellScriptOf } from './shell-parse.mjs';

/** @typedef {import('./review-gate-policy.mjs').PrCall} PrCall */
/** @typedef {import('./review-gate-policy.mjs').PrCommand} PrCommand */
/** @typedef {keyof typeof TOOLS} ToolName */

/**
 * @typedef {PrCall
 *   | { kind: 'agent-start', input: Record<string, unknown> }
 *   | { kind: 'agent-stop', agent: unknown, output: unknown }
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

/** @param {string} cwd @param {unknown} agent @param {unknown} output */
function recordRun(cwd, agent, output) {
  if (!countsAsRun(agent, output)) return;
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

/** @param {string} path @param {string} dir */
function readFile(path, dir) {
  try {
    return readFileSync(resolve(dir, path.replace(/^~(?=\/|$)/, homedir())), 'utf8');
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
  const dir = resolve(cwd, branchRefsOf(pr).dir ?? '.');
  let decision;
  try {
    decision = decidePr(pr, {
      readFile: (path) => readFile(path, dir),
      reviewersNotRun: () => (TOOLS[tool].tracksReviewers ? reviewersNotRun(pr, dir) : []),
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
    recordRun(cwd, call.agent, call.output);
  } else if (call.kind === 'shell' || call.kind === 'mcp') {
    for (const pr of prCommandsOf(call)) checkPr(pr, cwd, tool);
  }
}

main();
