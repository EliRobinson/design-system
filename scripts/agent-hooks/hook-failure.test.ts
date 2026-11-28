// @vitest-environment node
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Checkouts, makeCheckouts, removeCheckouts } from './checkout-fixtures';
import { hookFailed, mayWriteMainCheckout, messageOf } from './hook-failure.mjs';

// On-disk fixtures: see checkout-fixtures.ts. Its root stands in for the home
// folder, so `~/main` is the main checkout.
let fixture: Checkouts;
let home: string;
let main: string;
let wt: string;
let other: string;

beforeAll(() => {
  fixture = makeCheckouts('hook-failure-');
  ({ root: home, main, wt, other } = fixture);
});

afterAll(() => removeCheckouts(fixture));

describe('messageOf', () => {
  it.each([
    ['an Error', new Error('boom')],
    ['a thrown string', 'boom'],
  ])('reads the message of %s', (_name, error) => {
    expect(messageOf(error)).toBe('boom');
  });
});

describe('hookFailed', () => {
  it('names the message, and how to report it', () => {
    expect(hookFailed(new Error('boom'))).toBe(
      'The hook failed (boom), so this call is blocked. File an issue in this repo (label area:ci) with the shape of the command, never secrets or tokens. A simpler command may run.',
    );
  });
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
