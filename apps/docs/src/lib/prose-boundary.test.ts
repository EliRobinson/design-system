import { describe, expect, it } from 'vitest';

import { readSiteCss } from './css-source';

/* #367: every prose rule skips a `.not-prose` subtree, the class DemoBlock puts
   on a live demo's stage. The boundary is written on each rule, so a new
   `.prose table` rule without it would reach into every demo. This fails it.
   demo-boundary.test.ts proves in a browser that the guard works. */
const GUARD = ':where(:not(.not-prose, .not-prose *))';

const proseSelectors = () =>
  [...readSiteCss().matchAll(/([^{}]+)\{/g)]
    // Split the list on commas outside parentheses: the guard has one inside.
    .flatMap(([, list]) => list.split(/,(?![^(]*\))/))
    .map((selector) => selector.trim())
    .filter((selector) => /^\.prose[\s>+~]/.test(selector));

describe('site.css prose rules', () => {
  it('finds the prose rules to check', () => {
    expect(proseSelectors().length).toBeGreaterThan(20);
  });

  it('skip a not-prose subtree, every one', () => {
    const unguarded = proseSelectors().filter((selector) => !selector.includes(GUARD));
    expect(unguarded).toEqual([]);
  });
});
