// @vitest-environment node
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Checkouts, makeCheckouts, removeCheckouts } from './checkout-fixtures';
import { mainCheckoutOf } from './checkouts.mjs';

let fixture: Checkouts;

beforeAll(() => {
  fixture = makeCheckouts('checkouts-');
});

afterAll(() => removeCheckouts(fixture));

describe('mainCheckoutOf', () => {
  it('finds the main checkout from itself, a subfolder, and a linked worktree', () => {
    const { main, wt } = fixture;
    expect(mainCheckoutOf(main)).toBe(main);
    expect(mainCheckoutOf(join(main, 'packages/react'))).toBe(main);
    expect(mainCheckoutOf(wt)).toBe(main);
  });

  it('is null outside any checkout', () => {
    expect(mainCheckoutOf('/')).toBeNull();
  });
});
