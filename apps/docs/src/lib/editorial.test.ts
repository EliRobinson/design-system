import { describe, expect, it } from 'vitest';

import { HOOK_USED_BY, TIER_INTRO } from './editorial';
import { TIERS, hooks } from './manifest';

/* The editorial maps are keyed by manifest identifiers and the prose is
   hand-written, so a renamed hook or a new tier degrades silently at render
   time — a lost usage note, an empty tier intro. Equality of the key sets is
   the contract that turns that into a CI failure. */
describe('editorial maps cover the manifest', () => {
  it('documents exactly the hooks the package ships', () => {
    expect(Object.keys(HOOK_USED_BY).sort()).toEqual(hooks.map((h) => h.name).sort());
  });

  it('introduces exactly the tiers the package groups components under', () => {
    expect(Object.keys(TIER_INTRO).sort()).toEqual([...TIERS].sort());
  });
});
