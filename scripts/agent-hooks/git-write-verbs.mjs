// @ts-check
// The git verbs the main-checkout guard can refuse. This file imports
// nothing, so the guard's crash fallback (hook-failure.mjs) can read the list
// when the policy fails to load (#479).

/**
 * Git verbs that change the working tree, the index, or the checked-out
 * branch. guard-main-checkout-policy.mjs pairs each with the test for whether
 * a call of it does. Everything else is allowed: a blocklist, because a false
 * refusal on a harmless read is how a guard gets switched off. Absent on
 * purpose:
 * - `fetch`, `push` and `branch`: they change no working tree, and the
 *   coordinator runs them in the main checkout.
 * - `update-ref` and `symbolic-ref`: plumbing no agent workflow uses, and
 *   `git symbolic-ref HEAD` is a common read.
 */
export const MUTATING_GIT_VERB_NAMES = [
  'add',
  'am',
  'checkout',
  'cherry-pick',
  'clean',
  'commit',
  'merge',
  'mv',
  'pull',
  'rebase',
  'reset',
  'restore',
  'revert',
  'rm',
  'switch',
  'read-tree',
  'checkout-index',
  'update-index',
  'stash',
  'bisect',
  'sparse-checkout',
  'submodule',
  'apply',
  'worktree',
];
