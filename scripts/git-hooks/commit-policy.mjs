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

/** Returns why this commit message is rejected, or null.
 *  `raw` is for a stored commit: git has already stripped its comments, so a
 *  `#` line left in it is content and counts. */
export function checkCommitMessage(text, { raw = false } = {}) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (!raw && SCISSORS.test(line)) break;
    // Known gap: git keeps `#` lines for `-m` and `-F`, and some people set
    // another core.commentChar. Both are rare; `range` in CI catches them.
    if (!raw && line.startsWith('#')) continue;
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
    const problem = checkCommitMessage(message, { raw: true });
    if (!problem) return [];
    const subject = message.split('\n').find((line) => line.trim() !== '') ?? '';
    return [`${sha} ${subject}: ${problem}`];
  });
}

/* Merge commits are skipped (ADR 0002): main takes rebase-merges only, and
   GitHub's own `Merge <sha> into <sha>` is not ours to word. Git exits
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

function checkRange(range) {
  if (!range) return 'Give a range, for example origin/main..HEAD.';
  const problems = checkCommits(commitsIn(range));
  if (problems.length === 0) return null;
  return [
    'these commits break the one-line rule:',
    ...problems,
    'Reword them with `git rebase -i`.',
  ].join('\n');
}

const MODES = {
  branch: {
    usage: 'branch',
    prefix: 'commit blocked',
    run: () => checkBranch(currentBranch(), process.env),
  },
  'commit-msg': {
    usage: 'commit-msg <file>',
    prefix: 'commit blocked',
    run: (file) => checkCommitMessage(readFileSync(file, 'utf8')),
  },
  range: { usage: 'range <a>..<b>', prefix: 'commit policy', run: checkRange },
};

function main([mode, arg]) {
  const entry = Object.hasOwn(MODES, mode) ? MODES[mode] : null;
  const usage = Object.values(MODES)
    .map((m) => `"${m.usage}"`)
    .join(', ');
  const problem = entry ? entry.run(arg) : `Unknown mode: ${mode}. Use ${usage}.`;
  if (problem) {
    process.stderr.write(
      `${entry?.prefix ?? 'commit policy'}: ${problem}\nSee docs/agents/git-workflow.md.\n`,
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
