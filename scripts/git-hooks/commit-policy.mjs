#!/usr/bin/env node
/* Commit rules from docs/agents/git-workflow.md, run by the husky hooks.
 *
 *   node scripts/git-hooks/commit-policy.mjs branch            (pre-commit)
 *   node scripts/git-hooks/commit-policy.mjs commit-msg <file> (commit-msg)
 *   node scripts/git-hooks/commit-policy.mjs range <a>..<b>    (CI, quality.yml)
 *
 * `range` is the backstop: git's sequencer (revert, cherry-pick, rebase -i)
 * skips the hooks, so CI reads every commit a pull request adds (#278).
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
    // another core.commentChar. Both are rare; `range` in CI is the backstop.
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

/** Returns one line per commit that breaks the rule: `<sha> <subject>: <why>`. */
export function checkCommits(commits) {
  return commits.flatMap(({ sha, message }) => {
    const problem = checkCommitMessage(message);
    if (!problem) return [];
    const [subject] = message.split('\n');
    return [`${sha} ${subject}: ${problem}`];
  });
}

/* Merge commits are skipped: main takes rebase-merges only, so none lands
   there, and GitHub's own `Merge <sha> into <sha>` is not ours to word.
   `%B` is the raw message, so `#` lines count, as they do on main. Git exits
   non-zero on a bad range, and execFileSync throws, so a typo never passes. */
function commitsIn(range) {
  const log = execFileSync('git', ['log', '--no-merges', '--format=%h%x00%B%x1e', range], {
    encoding: 'utf8',
  });
  return log
    .split('\x1e')
    .map((entry) => entry.replace(/^\n/, ''))
    .filter((entry) => entry !== '')
    .map((entry) => {
      const [sha, message] = entry.split('\0');
      return { sha, message };
    });
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

function main([mode, arg]) {
  let problem;
  if (mode === 'branch') problem = checkBranch(currentBranch(), process.env);
  else if (mode === 'commit-msg') problem = checkCommitMessage(readFileSync(arg, 'utf8'));
  else if (mode === 'range') {
    if (!arg) problem = 'Give a range, for example origin/main..HEAD.';
    else {
      const problems = checkCommits(commitsIn(arg));
      if (problems.length)
        problem = `these commits break the one-line rule:\n${problems.join('\n')}\nReword them with \`git rebase -i\`.`;
    }
  } else problem = `Unknown mode: ${mode}. Use "branch", "commit-msg <file>" or "range <a>..<b>".`;

  if (problem) {
    process.stderr.write(`commit blocked: ${problem}\nSee docs/agents/git-workflow.md.\n`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
