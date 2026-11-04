#!/usr/bin/env node
// @ts-check
// Entry for the main-checkout guard, a Claude Code PreToolUse hook on Bash.
// See docs/agents/git-workflow.md. The rules live in
// guard-main-checkout-policy.mjs.
//
// Exit 2 refuses the call and shows stderr to the agent. Exit 0 allows it.
//
// It fails OPEN, and only on its own crash. This hook sees every Bash call
// in the repo, so a bug that made it throw would refuse all of them, in
// every session, with no way to run the fix. The crash is named on stderr,
// so it is not mistaken for a clean allow.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guardDecision, mainCheckoutOf } from './guard-main-checkout-policy.mjs';

// The repo this file sits in: the main checkout, or a worktree of it.
const OWN_CHECKOUT = fileURLToPath(new URL('../..', import.meta.url));

function main() {
  const raw = readFileSync(0, 'utf8');
  if (raw.trim() === '') return;
  const event = JSON.parse(raw);
  const command = event?.tool_input?.command;
  if (event?.tool_name !== 'Bash' || typeof command !== 'string') return;
  const decision = guardDecision(
    { command, cwd: typeof event.cwd === 'string' ? event.cwd : process.cwd() },
    mainCheckoutOf(OWN_CHECKOUT),
  );
  if (decision.blocked) {
    process.stderr.write(`${decision.reason}\n`);
    process.exit(2);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`guard-main-checkout: hook crashed, allowing the call: ${error}\n`);
}
