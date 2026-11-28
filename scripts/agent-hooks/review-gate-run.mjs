// @ts-check
// The pre-PR review gate's work, loaded by review-gate.mjs with import(), so
// that a throw while this file or the parser loads takes the entry's crash
// path too (#479). See docs/agents/git-and-prs.md.

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
 *   | { kind: 'other' }} Call
 * @typedef {(message: string) => never} Deny Denies the call with `message`,
 *   which the entry puts after its refusal prefix.
 */

// ---- Tool calls ----

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

/** @type {Record<ToolName, (event: any) => Call>} */
const TO_CALL = {
  claude(event) {
    if (event.tool_name === 'Agent' || event.tool_name === 'Task') {
      return { kind: 'agent-start', input: event.tool_input ?? {} };
    }
    return toolCall('claude', event.tool_name, event.tool_input);
  },
  codex: (event) => toolCall('codex', event.tool_name, event.tool_input),
  gemini: (event) => toolCall('gemini', event.tool_name, event.tool_input),
  cursor: (event) =>
    event.tool_name
      ? toolCall('cursor', event.tool_name, parseJson(event.tool_input))
      : { kind: 'shell', command: commandText(event.command) },
  copilot: (event) => toolCall('copilot', event.toolName, parseJson(event.toolArgs)),
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
    isReport(output) || typeof transcript !== 'string' ? null : readFrom(() => cwd, transcript);
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

// ---- Files ----

/**
 * Reads `path`, resolved from `base()` when it is relative. `base` is called
 * only then, so a caller with no folder for a relative path can throw there.
 * A `~` path is passed on as it is: readFile expands it.
 * @param {() => string} base @param {string} path
 */
function readFrom(base, path) {
  const passOn = isAbsolutePath(path) || /^~(\/|$)/.test(path);
  return readFile(passOn ? path : resolve(base(), path));
}

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

// ---- Checks ----

/** @param {PrCommand} pr @param {string} cwd @param {ToolName} tool @param {Deny} deny */
function checkPr(pr, cwd, tool, deny) {
  const refs = branchRefsOf(pr);
  const dir = refs.dir === null ? null : resolve(cwd, refs.dir);
  // The folder to read a relative path and the reviewer runs from. decidePr
  // refuses before it needs one the parser could not tell; never fall back
  // to the hook's own (#472).
  const inDir = () => {
    if (dir === null) throw new Error('no folder is known for this PR command');
    return dir;
  };
  // A throw here reaches the entry, which blocks the call.
  const decision = decidePr(pr, {
    // inDir runs only for a relative path, after decidePr ruled out a null folder.
    readFile: (path) => readFrom(inDir, path),
    reviewersNotRun: () => (TOOLS[tool].tracksReviewers ? reviewersNotRun(pr, inDir()) : []),
  });
  if (decision) deny(decision.deny);
}

/**
 * Records the run of a Claude Code subagent that has stopped, when it is a
 * reviewer with a report.
 * @param {any} event A SubagentStop event.
 * @param {string} cwd
 */
export function recordStop(event, cwd) {
  recordRun(cwd, event.agent_type, event.last_assistant_message, event.agent_transcript_path);
}

/**
 * Checks one tool call, and denies it through `deny` when the gate refuses
 * it. Returns when the call may run. Throws when it cannot read the call.
 * @param {string} tool @param {any} event @param {string} cwd @param {Deny} deny
 */
export function checkCall(tool, event, cwd, deny) {
  if (!Object.hasOwn(TOOLS, tool)) throw new Error(`no rules for --agent "${tool}"`);
  const name = /** @type {ToolName} */ (tool);
  const call = TO_CALL[name](event);
  if (call.kind === 'agent-start') {
    const decision = decideReviewerStart(call.input);
    if (decision) deny(decision.deny);
  } else if (call.kind === 'shell' || call.kind === 'mcp') {
    if (call.kind === 'shell') {
      // A merge that bypasses branch protection, or a gh word or endpoint the
      // hook cannot read that may hide a PR open or merge, is refused
      // whatever the PR body says.
      const bypass = findBypass(call.command);
      if (bypass) deny(bypass);
    }
    for (const pr of prCommandsOf(call)) checkPr(pr, cwd, name, deny);
  }
}
