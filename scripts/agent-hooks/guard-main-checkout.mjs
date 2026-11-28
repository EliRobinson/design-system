#!/usr/bin/env node
// @ts-check
// Entry for the main-checkout guard, a Claude Code PreToolUse hook on Bash.
// See docs/agents/git-workflow.md. The rules live in
// guard-main-checkout-policy.mjs.
//
// Exit 2 refuses the call and shows stderr to the agent. Exit 0 allows it.
//
// When the policy or its shell parser throws, while it loads or while it
// runs, the guard blocks only a call that may write in the main checkout:
// one that runs there, names a folder there, or holds a git or gh write word
// (mayWriteMainCheckout in hook-failure.mjs, which reads the raw text with
// no parser). Every other call is allowed, and the crash is named on stderr.
// This hook sees every Bash call in the repo, so blocking them all on a crash
// would lock every session out of the shell, with no way to run the fix.
// Blocking none would let a write through to the one folder this hook exists
// to guard (#479). So the policy is loaded with import() inside the try, and
// this file imports only modules with no parser. Stdin that is not JSON
// holds no call to read, so it is allowed.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { mainCheckoutOf } from './checkouts.mjs';
import { withoutGitRepoEnv } from './git-env.mjs';
import { hookFailed, mayWriteMainCheckout } from './hook-failure.mjs';

// The repo this file sits in: the main checkout, or a worktree of it.
const OWN_CHECKOUT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * `alias.<name>` from git's config, as git reads it for this repo: global
 * and repo config together. Null when there is none, or git fails.
 * @param {string} name
 * @returns {string | null}
 */
function aliasOf(name) {
  const env = withoutGitRepoEnv(process.env);
  try {
    const value = execFileSync('git', ['config', '--get', `alias.${name}`], {
      cwd: OWN_CHECKOUT,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    return value === '' ? null : value;
  } catch {
    return null;
  }
}

/**
 * The main checkout to guard, or null when it cannot be read. Null makes
 * every main checkout count, so the guard keeps guarding.
 */
function ownMainCheckout() {
  try {
    return mainCheckoutOf(OWN_CHECKOUT);
  } catch {
    return null;
  }
}

/** @param {unknown} error */
const messageOf = (error) => (error instanceof Error ? error.message : String(error));

/**
 * @param {unknown} error
 * @param {{ text: string, cwd: string }} crashInput
 * @param {string | null} mainRoot
 */
function onCrash(error, crashInput, mainRoot) {
  let block = true;
  try {
    block = mayWriteMainCheckout(crashInput, mainRoot);
  } catch {
    // The fallback itself failed, so nothing is known: block.
  }
  if (block) {
    process.stderr.write(
      `guard-main-checkout: ${hookFailed(error)} Run it from your worktree, or split the call.\n`,
    );
    process.exitCode = 2;
  } else {
    process.stderr.write(
      `guard-main-checkout: hook crashed, allowing the call: ${messageOf(error)}\n`,
    );
  }
}

async function main() {
  const raw = readFileSync(0, 'utf8');
  if (raw.trim() === '') return;
  let event;
  try {
    event = JSON.parse(raw);
  } catch (error) {
    process.stderr.write(
      `guard-main-checkout: hook crashed, allowing the call: ${messageOf(error)}\n`,
    );
    return;
  }
  const command = event?.tool_input?.command;
  if (event?.tool_name !== 'Bash' || typeof command !== 'string') return;
  const cwd = typeof event.cwd === 'string' ? event.cwd : process.cwd();
  const mainRoot = ownMainCheckout();
  try {
    const { guardDecision } = await import('./guard-main-checkout-policy.mjs');
    const decision = guardDecision({ command, cwd }, mainRoot, aliasOf);
    if (decision.blocked) {
      // exitCode, not exit(): exit() can cut off a stderr pipe write.
      process.stderr.write(`${decision.reason}\n`);
      process.exitCode = 2;
    }
  } catch (error) {
    onCrash(error, { text: command, cwd }, mainRoot);
  }
}

await main();
