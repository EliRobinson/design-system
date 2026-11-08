/* Every shadow token has a dark value (#255).
 *
 * The light shadows are black at 4–20% alpha. The dark page is ink-1000, and
 * black at any alpha on it is black on near-black, so cards, popovers, menus
 * and the SegmentedControl thumb lost their elevation in dark mode while
 * nothing failed. A shadow that reads on a dark page needs a light edge as
 * well as a deeper shadow.
 *
 * Two claims, in every palette:
 *   1. No `--shadow-*` token resolves to the same value in dark as in light.
 *      A new shadow token that skips the dark block fails here.
 *   2. Every dark shadow has a layer that stands apart from --bg, so it can
 *      be seen. The floor is 1.1:1. That is not a WCAG number: a shadow is
 *      decoration, not text or a control edge. It is the line between an edge
 *      a reader can see and one that is only there on paper.
 *
 * The token list is read from the stylesheets, never typed out here.
 */

import { describe, expect, it } from 'vitest';

import { contrastRatio } from './color.mjs';
import { PALETTES, combinationValues } from './contrast.mjs';
import { readTokenStylesheets } from './token-stylesheets.mjs';

const sources = readTokenStylesheets();

/* A visible edge on the page, not a contrast requirement. See the header. */
const VISIBLE = 1.1;

const isShadow = (name) => name.startsWith('--shadow-');

/* Each colour in a resolved shadow: one per layer. */
const layerColours = (value) => value.match(/oklch\([^)]*\)|#[0-9a-f]{6}\b/gi) ?? [];

describe('shadow tokens in dark mode', () => {
  it('finds the shadow tokens', () => {
    const light = combinationValues(sources, { palette: PALETTES[0], theme: 'light' });
    expect([...light.keys()].filter(isShadow).length).toBeGreaterThanOrEqual(7);
  });

  describe.each(PALETTES)('%s', (palette) => {
    const light = combinationValues(sources, { palette, theme: 'light' });
    const dark = combinationValues(sources, { palette, theme: 'dark' });
    const shadows = [...light.keys()].filter(isShadow);

    it.each(shadows)('%s has its own dark value', (name) => {
      expect(dark.get(name)).toBeDefined();
      expect(dark.get(name)).not.toBe(light.get(name));
    });

    it.each(shadows)('%s has a layer that shows on --bg in dark', (name) => {
      const page = dark.get('--bg');
      const ratios = layerColours(dark.get(name)).map((colour) => contrastRatio(colour, page));
      expect(ratios.length).toBeGreaterThan(0);
      expect(ratios).not.toContain(null);
      expect(Math.max(...ratios)).toBeGreaterThanOrEqual(VISIBLE);
    });
  });
});
