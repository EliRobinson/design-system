import { describe, expect, it } from 'vitest';

import { elements } from './ai-elements';
import { ELEMENTS_TIER_INTRO, HOOK_NOTES, TIER_INTRO, hookUsage } from './editorial';
import { TIERS, components, hooks } from './manifest';

/* The editorial maps are keyed by manifest identifiers and the prose is
   hand-written, so a renamed hook or a new tier degrades silently at render
   time — a lost usage note, an empty tier intro. Equality of the key sets is
   the contract that turns that into a CI failure. */
describe('editorial maps cover the manifest', () => {
  it('keeps notes only for hooks the package ships', () => {
    const shipped = hooks.map((h) => h.name);
    expect(Object.keys(HOOK_NOTES).filter((name) => !shipped.includes(name))).toEqual([]);
  });

  it('introduces exactly the tiers the package groups components under', () => {
    expect(Object.keys(TIER_INTRO).sort()).toEqual([...TIERS].sort());
  });

  it('introduces exactly the namespaces the vendored manifest reports', () => {
    /* Against the manifest's own entries rather than against the written-down
       ELEMENTS_TIERS list, which would only prove two hand-kept arrays agree.
       A namespace an upstream re-sync adds renders an empty paragraph on two
       pages without this. */
    expect(Object.keys(ELEMENTS_TIER_INTRO).sort()).toEqual(
      [...new Set(elements.map((entry) => entry.tier))].sort(),
    );
  });
});

/* Who uses a hook comes from the manifest's import graph, never from prose
   (#394). A note that starts naming users again is the drift coming back. */
describe('hook usage lines', () => {
  it('takes the users from the manifest', () => {
    expect(hookUsage({ name: 'useRovingFocus', usedBy: ['SegmentedControl', 'Tabs'] })).toBe(
      'Used by SegmentedControl and Tabs.',
    );
  });

  it('puts the editorial note after the derived users', () => {
    expect(hookUsage({ name: 'useDisclosure', usedBy: ['Dialog', 'Popover', 'Sheet'] })).toBe(
      'Used by Dialog, Popover, and Sheet. A boolean wrapper on useControllableState.',
    );
  });

  it('says nothing about users when nothing imports the hook', () => {
    expect(hookUsage({ name: 'useUnused', usedBy: [] })).toBe('');
  });

  it('gives every shipped hook a usage line', () => {
    for (const hook of hooks) expect(hookUsage(hook), hook.name).toMatch(/^Used by /);
  });

  it('keeps component names out of the notes', () => {
    for (const [hook, note] of Object.entries(HOOK_NOTES)) {
      const named = components.filter((c) => new RegExp(`\\b${c.name}\\b`).test(note));
      expect(
        named.map((c) => c.name),
        hook,
      ).toEqual([]);
    }
  });
});
