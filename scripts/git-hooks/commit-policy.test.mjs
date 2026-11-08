import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkBranch, checkCommitMessage, checkCommits } from './commit-policy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const cli = join(here, 'commit-policy.mjs');

describe('checkBranch', () => {
  it('blocks a commit on main', () => {
    expect(checkBranch('main', {})).toMatch(/main/);
  });

  it('lets CI commit on main, because Release commits the version bump there', () => {
    expect(checkBranch('main', { CI: 'true' })).toBeNull();
  });

  it('allows any other branch', () => {
    expect(checkBranch('docs/coordinator-prompt', {})).toBeNull();
  });

  it('allows a detached HEAD, as during a rebase', () => {
    expect(checkBranch('', {})).toBeNull();
  });
});

describe('checkCommitMessage', () => {
  it.each([
    'fix(react): keep focus on the trigger',
    'docs: add the coordinator prompt',
    'feat(ai-patterns)!: drop the old contract',
    'fixup! fix(react): keep focus on the trigger',
    "Merge branch 'main' into docs/coordinator-prompt",
    "Merge remote-tracking branch 'origin/main' into fix/x",
  ])('accepts %s', (message) => {
    expect(checkCommitMessage(`${message}\n`)).toBeNull();
  });

  it('ignores git comment lines and everything below the scissors line', () => {
    const message = [
      'fix: one line',
      '# Please enter the commit message',
      '# ------------------------ >8 ------------------------',
      'diff --git a/x b/x',
    ].join('\n');
    expect(checkCommitMessage(message)).toBeNull();
  });

  it('rejects a body', () => {
    expect(checkCommitMessage('fix: one line\n\nMore words here.\n')).toMatch(/one line/);
  });

  it('rejects a trailer', () => {
    expect(checkCommitMessage('fix: one line\n\nCo-Authored-By: Someone <a@b.c>\n')).toMatch(
      /one line/,
    );
  });

  it.each([
    'Fix the thing',
    'fix:no space',
    'feature: not a type',
    'fix(React): capital scope',
    'Merge whatever I want',
    'amend! fix: one line',
    '',
  ])('rejects %j', (message) => {
    expect(checkCommitMessage(message)).not.toBeNull();
  });

  it('rejects a subject over 100 characters', () => {
    expect(checkCommitMessage(`fix: ${'a'.repeat(100)}`)).toMatch(/100/);
  });
});

describe('checkCommits', () => {
  it('passes one-line commits', () => {
    expect(checkCommits([{ sha: 'a1', message: 'fix: one line\n' }])).toEqual([]);
  });

  it('names each commit that fails, and why', () => {
    const problems = checkCommits([
      { sha: 'a1', message: 'fix: one line\n' },
      { sha: 'b2', message: 'fix: one line\n\nA body.\n' },
      { sha: 'c3', message: 'Revert "fix: x"\n' },
    ]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^b2 fix: one line: .*one line/);
    expect(problems[1]).toMatch(/^c3 Revert "fix: x": .*Conventional/);
  });

  it('counts `#` lines, which git has already cleaned up in a stored commit', () => {
    expect(checkCommits([{ sha: 'd4', message: 'fix: x\n\n#278 a body line\n' }])).toEqual([
      'd4 fix: x: Write one line only. No body. No trailers.',
    ]);
  });
});

/* Every bot commit in CI. The hooks do not run for the ones that set HUSKY: 0,
   and the quality check reads every commit on a pull request, so each message
   must pass on its own: one -m only. Release commits straight to main in CI,
   with the hooks on, so it breaks if its message stops passing. */
describe('the workflow bot commits', () => {
  const dir = join(root, '.github/workflows');
  const files = readdirSync(dir).filter((file) => /\.ya?ml$/.test(file));
  const commits = files.flatMap((file) => {
    const text = readFileSync(join(dir, file), 'utf8');
    return [...text.matchAll(/^\s*git commit\b(?:[^\n]*\\\n)*[^\n]*/gm)].map(([command]) => ({
      file,
      command,
    }));
  });

  it('finds the five bot commits', () => {
    expect(commits.map(({ file }) => file).sort()).toEqual([
      'release.yml',
      'visual-pr.yml',
      'visual-pr.yml',
      'visual-update.yml',
      'visual.yml',
    ]);
  });

  it.each(commits)('$file: $command', ({ command }) => {
    const messages = [...command.matchAll(/-m "([^"]+)"/g)].map(([, message]) => message);
    expect(messages).toHaveLength(1);
    // A shell expansion here is a count or a step output, so stand a number in.
    const message = messages[0].replace(/\$\{\{[^}]+\}\}|\$\{[^}]+\}/g, '3');
    expect(checkCommitMessage(`${message}\n`)).toBeNull();
  });
});

function runMsg(text) {
  const file = join(mkdtempSync(join(tmpdir(), 'commit-policy-')), 'COMMIT_EDITMSG');
  writeFileSync(file, text);
  return spawnSync('node', [cli, 'commit-msg', file], { encoding: 'utf8' });
}

describe('the CLI', () => {
  it('exits 1 with a reason for a bad message file', () => {
    const run = runMsg('Fix the thing\n');
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Conventional/);
  });

  it('exits 0 for a good message file', () => {
    expect(runMsg('fix: one line\n').status).toBe(0);
  });

  it('blocks a commit on main in a real repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'commit-policy-repo-'));
    git(dir, 'init', '-q', '-b', 'main');
    const env = { ...process.env, CI: '' };
    const run = spawnSync('node', [cli, 'branch'], { cwd: dir, encoding: 'utf8', env });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/main/);
  });
});

function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

/* The CI half: git's sequencer (revert, cherry-pick, rebase -i) skips the
   hooks, so the quality job reads every commit a pull request adds. */
describe('the CLI range mode', () => {
  function repo() {
    const dir = mkdtempSync(join(tmpdir(), 'commit-policy-range-'));
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'test@example.com');
    git(dir, 'config', 'user.name', 'Test');
    git(dir, 'config', 'core.hooksPath', '/dev/null');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'chore: base');
    git(dir, 'checkout', '-q', '-b', 'feature');
    return dir;
  }
  const commit = (dir, ...messages) =>
    git(dir, 'commit', '-q', '--allow-empty', ...messages.flatMap((m) => ['-m', m]));
  const range = (dir, ...args) =>
    spawnSync('node', [cli, 'range', ...(args.length ? args : ['main..HEAD'])], {
      cwd: dir,
      encoding: 'utf8',
    });

  it('passes one-line commits', () => {
    const dir = repo();
    commit(dir, 'fix: one line');
    commit(dir, 'revert: fix: one line');
    const run = range(dir);
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('fails a commit with a body', () => {
    const dir = repo();
    commit(dir, 'fix: one line', 'A body git revert or a squash would write.');
    const run = range(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^commit policy: /);
    expect(run.stderr).toMatch(/fix: one line: Write one line only/);
  });

  it('fails a body of `#` lines, which the commit-msg hook skips', () => {
    const dir = repo();
    commit(dir, 'fix: one line', '#278 a body line');
    const run = range(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/fix: one line: Write one line only/);
  });

  it("fails git's own revert subject, even on one line", () => {
    const dir = repo();
    commit(dir, 'Revert "fix: x"');
    const run = range(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Revert "fix: x": Use a Conventional Commit/);
  });

  it('skips merge commits, which a rebase-merge never lands on main', () => {
    const dir = repo();
    commit(dir, 'fix: one line');
    git(dir, 'checkout', '-q', 'main');
    commit(dir, 'feat: on main');
    git(dir, 'checkout', '-q', 'feature');
    git(dir, 'merge', '-q', '--no-ff', 'main', '-m', 'Merge abc123 into def456', '-m', 'Body.');
    expect(range(dir).status).toBe(0);
  });

  it('fails when git cannot read the range, rather than passing on nothing', () => {
    const dir = repo();
    expect(range(dir, 'nope..HEAD').status).not.toBe(0);
  });

  it('fails with no range given', () => {
    const run = spawnSync('node', [cli, 'range'], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/range/);
  });
});

/* The quality job is the only thing that runs range mode. */
describe('the quality workflow', () => {
  const workflow = readFileSync(join(root, '.github/workflows/quality.yml'), 'utf8');

  it('checks every commit the pull request adds', () => {
    expect(workflow).toContain(
      'node scripts/git-hooks/commit-policy.mjs range "origin/${BASE_REF}..${HEAD_SHA}"',
    );
  });
});

/* A hook that is not wired in passes without running. These prove it runs. */
describe('the husky hooks', () => {
  it('pre-commit runs the branch check first', () => {
    const lines = readFileSync(join(root, '.husky/pre-commit'), 'utf8').trim().split('\n');
    expect(lines[0]).toBe('node scripts/git-hooks/commit-policy.mjs branch');
  });

  it('commit-msg runs the message check', () => {
    const hook = readFileSync(join(root, '.husky/commit-msg'), 'utf8');
    expect(hook.trim()).toBe('node scripts/git-hooks/commit-policy.mjs commit-msg "$1"');
  });
});
