import { contrastRatio } from '@elirobinson/tokens/color';
import { COMBINATIONS, combinationValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import { prop, readSiteCss, stripComments } from './css-source';

/* #369: the hero read --bg-inverse / --fg-inverse. Those flip with the theme,
   so in dark the hero became a white slab, and its amber stats (--accent, a
   fill, 2.53:1 on white) failed 3:1.

   The hero is the brand's dark slab in BOTH themes. So it may read only tokens
   that do not move with the theme, and the pairs it draws must clear AA on that
   fixed slab. Each pair is measured under every palette and theme the system
   ships, with the token values a browser would resolve. */

const SITE_CSS = readSiteCss();
const sheets = readTokenStylesheets().map(stripComments);

function varsIn(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
}

/* A hero colour is `var(--hero-*)`, declared on `.home-hero` as `var(--ink-*)`:
   follow the hero's own indirection, then resolve against the theme's tokens. */
function color(selector: string, property: string, values: Map<string, string>): string {
  let name = varsIn(prop(SITE_CSS, selector, property))[0];
  while (name.startsWith('--hero-')) name = varsIn(prop(SITE_CSS, '.home-hero', name))[0];
  const resolved = values.get(name);
  if (!resolved) throw new Error(`cannot resolve ${selector} ${property}`);
  return resolved;
}

describe('docs home hero', () => {
  it('keeps its dot grid visible on the slab', () => {
    expect(prop(SITE_CSS, '.home-hero', 'background-image')).toContain('radial-gradient');
  });

  describe.each(COMBINATIONS)('$palette / $theme', (combination) => {
    const values = combinationValues(sheets, combination);
    const slab = color('.home-hero', 'background', values);

    it('is a dark slab', () => {
      expect(contrastRatio('#000000', slab)!).toBeLessThan(2);
    });

    // [selector, property, minimum ratio]. 3:1 is the large-text floor: the
    // stat figures are 30px semibold.
    it.each([
      ['.home-hero', 'color', 4.5],
      ['.home-hero__eyebrow', 'color', 4.5],
      ['.home-hero__title', 'color', 4.5],
      ['.home-hero__lead', 'color', 4.5],
      ['.home-hero__secondary', 'color', 4.5],
      ['.home-hero__secondary:hover', 'color', 4.5],
      ['.home-hero__stat dd', 'color', 3],
      ['.home-hero__stat dt', 'color', 4.5],
      // the keyboard focus ring is a UI component: 3:1 (SC 1.4.11)
      ['.home-hero', '--focus-ring', 3],
    ] as const)('%s %s clears %s:1 on the slab', (selector, property, min) => {
      const ratio = contrastRatio(color(selector, property, values), slab);
      expect(ratio).not.toBeNull();
      expect(ratio!).toBeGreaterThanOrEqual(min);
    });
  });
});
