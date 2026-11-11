import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contrastRatio } from '@elirobinson/tokens/color';
import { COMBINATIONS, combinationValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import { stripComments } from './css-source';

/* #369: the hero read --bg-inverse / --fg-inverse. Those flip with the theme,
   so in dark the hero became a white slab, and its amber stats (--accent, a
   fill, 2.53:1 on white) failed 3:1.

   The hero is the brand's dark slab in BOTH themes. So it may read only tokens
   that do not move with the theme, and the pairs it draws must clear AA on that
   fixed slab. Each pair is measured under every palette and theme the system
   ships, with the token values a browser would resolve. */

const SITE_CSS = stripComments(readFileSync(join(process.cwd(), 'src/app/site.css'), 'utf8'));
const sheets = readTokenStylesheets().map(stripComments);

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = SITE_CSS.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

function varsIn(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
}

function prop(selector: string, name: string): string {
  const m = rule(selector).match(new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+);`));
  if (!m) throw new Error(`${selector} has no ${name}`);
  return m[1].trim();
}

function color(value: string, values: Map<string, string>): string {
  const name = varsIn(value)[0];
  const resolved = values.get(name);
  if (!resolved) throw new Error(`cannot resolve ${value}`);
  return resolved;
}

describe('docs home hero', () => {
  it('keeps its dot grid visible on the slab', () => {
    expect(prop('.home-hero', 'background-image')).toContain('radial-gradient');
  });

  describe.each(COMBINATIONS)('$palette / $theme', (combination) => {
    const values = combinationValues(sheets, combination);
    const slab = color(prop('.home-hero', 'background'), values);

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
    ] as const)('%s %s clears %s:1 on the slab', (selector, property, min) => {
      const ratio = contrastRatio(color(prop(selector, property), values), slab);
      expect(ratio).not.toBeNull();
      expect(ratio!).toBeGreaterThanOrEqual(min);
    });
  });
});
