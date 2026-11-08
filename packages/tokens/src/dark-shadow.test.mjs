/* Every shadow token has a dark value (#255).
 *
 * The light shadows are black at 4–20% alpha. The dark page is ink-1000, and
 * black at any alpha on it is black on near-black, so cards, popovers, menus
 * and the SegmentedControl thumb lost their elevation in dark mode while
 * nothing failed. A shadow that reads on a dark page needs a light edge as
 * well as a deeper shadow.
 *
 * Three claims, for every `--shadow-*` token:
 *   1. It resolves to a different value in dark than in light. A new shadow
 *      token that skips the dark block fails here.
 *   2. In dark, one of its layers stands apart from --bg AND has a size, so
 *      it draws something. The floor is 1.1:1. That is not a WCAG number: a
 *      shadow is decoration, not text or a control edge. It is the line
 *      between an edge a reader can see and one that is only there on paper.
 *      The weakest ring, white at 8%, measures 1.14:1 on black.
 *      `--shadow-focus` passes through its `--focus-ring` layer, on purpose:
 *      it has no dark line of its own because both its colours already flip.
 *   3. Every light layer's geometry (offsets, blur, spread) is still in the
 *      dark value. Dark changes the colours and may add a layer, but it does
 *      not re-draw the shape, so the two themes cannot drift apart.
 *
 * It runs in every palette, not just the default. No palette overrides a
 * shadow or dark --bg today, and this is the guard for the first one that does.
 * The token list is read from the stylesheets, never typed out here.
 */

import { describe, expect, it } from 'vitest';

import { colorsIn, contrastRatio } from './color.mjs';
import { PALETTES, combinationValues } from './contrast.mjs';
import { readTokenStylesheets } from './token-stylesheets.mjs';

const sources = readTokenStylesheets();

/* A visible edge on the page, not a contrast requirement. See the header. */
const VISIBLE = 1.1;

const isShadow = (name) => name.startsWith('--shadow-');

/* The layers of a box-shadow: split on commas outside parentheses. */
function layers(value) {
  const out = [];
  let depth = 0;
  let start = 0;
  [...value].forEach((char, index) => {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      out.push(value.slice(start, index).trim());
      start = index + 1;
    }
  });
  out.push(value.slice(start).trim());
  return out;
}

/* One layer as its colour and its geometry, the geometry being what is left. */
function parseLayer(layer) {
  const colours = colorsIn(layer);
  if (colours.length !== 1) throw new Error(`expected one colour this can read in "${layer}"`);
  const [colour] = colours;
  return { colour, geometry: layer.replace(colour, '').replace(/\s+/g, ' ').trim() };
}

/* A layer with every length at zero draws nothing, whatever its colour. */
const hasSize = (geometry) =>
  geometry
    .split(' ')
    .filter((part) => part !== 'inset')
    .some((part) => parseFloat(part) !== 0);

describe.each(PALETTES)('shadow tokens in dark mode: %s', (palette) => {
  const light = combinationValues(sources, { palette, theme: 'light' });
  const dark = combinationValues(sources, { palette, theme: 'dark' });
  const shadows = [...light.keys()].filter(isShadow);

  it('finds shadow tokens to check', () => {
    expect(shadows.length).toBeGreaterThan(0);
  });

  it.each(shadows)('%s has its own dark value', (name) => {
    expect(dark.get(name)).toBeDefined();
    expect(dark.get(name)).not.toBe(light.get(name));
  });

  it.each(shadows)('%s has a layer that shows on --bg in dark', (name) => {
    const page = dark.get('--bg');
    const visible = layers(dark.get(name))
      .map(parseLayer)
      .filter(({ geometry }) => hasSize(geometry))
      .map(({ colour }) => contrastRatio(colour, page));
    expect(visible).not.toContain(null);
    expect(Math.max(0, ...visible)).toBeGreaterThanOrEqual(VISIBLE);
  });

  it.each(shadows)('%s keeps every light layer geometry in dark', (name) => {
    const darkGeometry = layers(dark.get(name)).map((layer) => parseLayer(layer).geometry);
    for (const layer of layers(light.get(name))) {
      expect(darkGeometry).toContain(parseLayer(layer).geometry);
    }
  });
});
