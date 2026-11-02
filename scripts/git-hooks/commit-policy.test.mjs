import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkBranch, checkCommitMessage } from './commit-policy.mjs';

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

/* Release commits on main inside CI, and the hooks run there (no HUSKY: 0).
   If its message or the CI exemption ever stops passing, Release breaks. */
describe('the Release workflow commit', () => {
  const workflow = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');
  const [, message] = workflow.match(/git commit -m "([^"]+)"/) ?? [];

  it('passes the message check', () => {
    expect(message).toBeDefined();
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
    execFileSync('git', ['init', '-q', '-b', 'main', dir]);
    const env = { ...process.env, CI: '' };
    const run = spawnSync('node', [cli, 'branch'], { cwd: dir, encoding: 'utf8', env });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/main/);
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
