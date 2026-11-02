#!/usr/bin/env node
/* Commit rules from docs/agents/git-workflow.md, run by the husky hooks.
 *
 *   node scripts/git-hooks/commit-policy.mjs branch            (pre-commit)
 *   node scripts/git-hooks/commit-policy.mjs commit-msg <file> (commit-msg)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
];
const SUBJECT = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9][a-z0-9./-]*\\))?!?: \\S`);
const MAX_LENGTH = 100;
const SCISSORS = /^# -+ >8 -+$/;
// The subjects `git merge` and `git pull` write.
const GIT_MERGE = /^Merge (branch|branches|remote-tracking branch|tag|commit) /;

/** Returns why a commit on this branch is blocked, or null. */
export function checkBranch(branch, env) {
  if (branch !== 'main') return null;
  // Release commits the version bump straight to main from CI.
  if (env.CI) return null;
  return 'Do not commit on main. Cut a branch from origin/main in its own worktree.';
}

/** Returns why this commit message is rejected, or null. */
export function checkCommitMessage(text) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (SCISSORS.test(line)) break;
    // Known gap: git keeps `#` lines for `-m` and `-F`, and some people set
    // another core.commentChar. Both are rare; CI is the backstop (#278).
    if (line.startsWith('#')) continue;
    lines.push(line.trimEnd());
  }
  const filled = lines.filter((line) => line !== '');
  if (filled.length === 0) return 'The commit message is empty.';
  if (filled.length > 1) return 'Write one line only. No body. No trailers.';

  const [subject] = filled;
  if (GIT_MERGE.test(subject)) return null;
  // `amend!` is left out on purpose: git always gives it a body.
  const bare = subject.replace(/^(fixup|squash)! /, '');
  if (!SUBJECT.test(bare)) {
    return `Use a Conventional Commit: <type>(<scope>): <subject>. Types: ${TYPES.join(', ')}.`;
  }
  if (subject.length > MAX_LENGTH) return `Keep the line to ${MAX_LENGTH} characters or fewer.`;
  return null;
}

function currentBranch() {
  try {
    return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return ''; // detached HEAD
  }
}

function main([mode, file]) {
  let problem;
  if (mode === 'branch') problem = checkBranch(currentBranch(), process.env);
  else if (mode === 'commit-msg') problem = checkCommitMessage(readFileSync(file, 'utf8'));
  else problem = `Unknown mode: ${mode}. Use "branch" or "commit-msg <file>".`;

  if (problem) {
    process.stderr.write(`commit blocked: ${problem}\nSee docs/agents/git-workflow.md.\n`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
