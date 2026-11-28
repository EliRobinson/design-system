// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MUTATING_GIT_VERBS } from './guard-main-checkout-policy.mjs';
import { MUTATING_GIT_VERB_NAMES, hookFailed, mayWriteMainCheckout } from './hook-failure.mjs';

// On-disk fixtures, shaped the way git lays them out, under a fake home:
//   home/main/                         a main checkout (`.git` is a directory)
//   home/main/.claude/worktrees/wt/    a linked worktree (`.git` is a file)
//   home/other/                        another project's main checkout
let home: string;
let main: string;
let wt: string;
let other: string;

beforeAll(() => {
  home = realpathSync(mkdtempSync(join(tmpdir(), 'hook-failure-')));
  main = join(home, 'main');
  wt = join(main, '.claude/worktrees/wt');
  other = join(home, 'other');
  mkdirSync(join(main, '.git/worktrees/wt'), { recursive: true });
  mkdirSync(join(main, 'packages'), { recursive: true });
  mkdirSync(wt, { recursive: true });
  writeFileSync(join(wt, '.git'), `gitdir: ${join(main, '.git/worktrees/wt')}\n`);
  mkdirSync(join(other, '.git'), { recursive: true });
});

afterAll(() => rmSync(home, { recursive: true, force: true }));

describe('hookFailed', () => {
  it.each([
    ['an Error', new Error('boom'), 'boom'],
    ['a thrown string', 'boom', 'boom'],
  ])('names the message of %s, and how to report it', (_name, error, why) => {
    expect(hookFailed(error)).toBe(
      `The hook failed (${why}), so this call is blocked. File an issue in this repo (label area:ci) with the shape of the command, never secrets or tokens. A simpler command may run.`,
    );
  });
});

it('lists the same verbs the guard refuses', () => {
  expect([...MUTATING_GIT_VERBS.keys()]).toEqual(MUTATING_GIT_VERB_NAMES);
});

// What the guard reads from the raw text when its rules throw.
describe('mayWriteMainCheckout', () => {
  type Row = [string, () => string, () => string, boolean];
  it.each<Row>([
    ['a read run in the main checkout', () => 'ls', () => main, true],
    ['a read run in a subfolder of it', () => 'ls', () => join(main, 'packages'), true],
    ['a read that names a folder in it', () => `cat ${main}/packages/x`, () => wt, true],
    ['a read that names it, quoted', () => `ls "${main}"`, () => wt, true],
    ['a `~/` path into it', () => 'ls ~/main/packages', () => wt, true],
    ['a `$HOME/` path into it', () => 'cd $HOME/main && ls', () => wt, true],
    ['a `${HOME}/` path into it', () => 'ls "${HOME}/main"', () => wt, true],
    ['a `~/` path into a worktree', () => 'ls ~/main/.claude/worktrees/wt', () => other, false],
    ['a `~/` path to a sibling folder', () => 'ls ~/main-old', () => other, false],
    ['git with a write verb', () => 'cd $D && git add -A', () => wt, true],
    ['gh pr checkout', () => 'gh pr checkout 5', () => wt, true],
    ['a read in a worktree', () => 'ls -la', () => wt, false],
    ['a read that names a worktree', () => `ls ${wt}/src`, () => other, false],
    ['git with no write verb', () => 'git status && git log', () => wt, false],
    ['a write verb with no git', () => 'pnpm add react', () => wt, false],
    ['a verb inside a longer word', () => 'git status --add-ons', () => wt, false],
    ['a relative path, which it does not catch', () => 'cd ../../.. && ls', () => wt, false],
  ])('%s', (_name, text, cwd, expected) => {
    expect(mayWriteMainCheckout({ text: text(), cwd: cwd() }, main, home)).toBe(expected);
  });

  it('counts any main checkout when its own cannot be found', () => {
    expect(mayWriteMainCheckout({ text: 'ls', cwd: other }, null, home)).toBe(true);
  });

  it('counts no worktree when its own main checkout cannot be found', () => {
    expect(mayWriteMainCheckout({ text: 'ls', cwd: wt }, null, home)).toBe(false);
  });
});
