#!/usr/bin/env node
// @ts-check
// Entry for the pre-PR review gate hook. See docs/agents/git-and-prs.md.
// Usage: node review-gate.mjs --agent=<claude|codex|gemini|cursor|copilot>
// The work is in review-gate-run.mjs.
//
// Stdin that is not a JSON object passes through. So does a SubagentStop
// event: it records a reviewer's run, and has no call to block. Any error
// while the hook loads its rules or checks a tool call, such as the shell
// parser throwing, blocks that call (#479): the parser is what finds a PR
// open or a merge bypass, so a call it could not read may hide one. The rules
// are loaded with import() inside the try, and this file imports only
// hook-failure.mjs, so a throw while they load blocks too.
//
// The trade-off, by design per #479: the gate parses every shell call, so a
// parser that throws on every input blocks all Bash through the gate until it
// is fixed. Edits and humans are not blocked.

import { readFileSync } from 'node:fs';

import { hookFailed } from './hook-failure.mjs';

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

// How each tool is told a call is denied. Its keys are the tools the rules
// know (TOOLS in review-gate-policy.mjs); review-gate-run.mjs throws on any
// other.
/** @type {Record<string, (message: string) => never>} */
const DENY = {
  claude: exitDeny,
  codex: exitDeny,
  gemini: exitDeny,
  cursor: (message) =>
    jsonDeny({ permission: 'deny', user_message: message, agent_message: message }),
  copilot: (message) => jsonDeny({ permissionDecision: 'deny', permissionDecisionReason: message }),
};

async function main() {
  const flag = '--agent=';
  const tool = (process.argv.find((arg) => arg.startsWith(flag)) ?? '').slice(flag.length);
  if (!Object.hasOwn(DENY, tool)) {
    process.stderr.write(
      `review-gate: unknown --agent "${tool}". Use one of: ${Object.keys(DENY).join(', ')}.\n`,
    );
    process.exit(1);
  }
  const deny = DENY[tool];

  let event;
  try {
    event = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  if (!event || typeof event !== 'object') return;
  const cwd = typeof event.cwd === 'string' ? event.cwd : process.cwd();

  // A reviewer that has stopped is no call to block: exit 2 there would keep
  // it running. A throw here exits 1, and its run is just not recorded.
  if (tool === 'claude' && event.hook_event_name === 'SubagentStop') {
    const { recordStop } = await import('./review-gate-run.mjs');
    recordStop(event, cwd);
    return;
  }

  try {
    const { checkCall } = await import('./review-gate-run.mjs');
    checkCall(tool, event, cwd, deny);
  } catch (error) {
    deny(`Blocked by the review gate. ${hookFailed(error)}`);
  }
}

await main();
