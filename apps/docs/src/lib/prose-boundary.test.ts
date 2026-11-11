import { describe, expect, it } from 'vitest';

import { readSiteCss } from './css-source';

/* #367: every prose rule skips a `.not-prose` subtree, the class DemoBlock puts
   on a live demo's stage. The boundary is written on each rule, so a new
   `.prose table` rule without it would reach into every demo. This fails it.
   demo-boundary.test.ts proves in a browser that the guard works. */
const GUARD = ':where(:not(.not-prose, .not-prose *))';

/* The guard must sit on the last compound, the element the rule styles. A
   trailing pseudo-class such as `:hover` is fine. */
const ENDS_GUARDED = new RegExp(`${GUARD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(:[\\w-]+)*$`);

const proseSelectors = () =>
  [...readSiteCss().matchAll(/([^{}]+)\{/g)]
    // Split the list on commas outside parentheses: the guard has one inside.
    .flatMap(([, list]) => list.split(/,(?![^(]*\))/))
    .map((selector) => selector.trim())
    // Every selector that styles inside .prose, wherever .prose sits in it
    // (`.dark .prose code` too). The bare `.prose` root rule styles no child.
    .filter((selector) => /(^|[\s>+~])\.prose(?=[\s>+~])/.test(selector));

describe('site.css prose rules', () => {
  it('finds the prose rules to check', () => {
    expect(proseSelectors().length).toBeGreaterThan(20);
  });

  it('skip a not-prose subtree, every one', () => {
    const unguarded = proseSelectors().filter((selector) => !ENDS_GUARDED.test(selector));
    expect(unguarded).toEqual([]);
  });
});
