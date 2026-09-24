/* SegmentedControl: the selected segment can be told from the others.
 *
 * #252, from fantasy-gbbo#85: in dark mode the selected option looked like the
 * unselected ones. The selected fill is --surface and the track is
 * --bg-subtle, and in dark both resolve to ink-950 — 1.00:1. The only other
 * cue was --shadow-sm, a black shadow on a black page. Each token was correct
 * on its own; the pair was not, which is the shape of bug a per-token sweep
 * cannot see.
 *
 * The state now rides on an inset ring. This file reads the tokens the shipped
 * stylesheet names for the track, the selected fill and the ring, resolves
 * them in every palette x theme, and asserts the ring clears 3:1 (SC 1.4.11)
 * against the fill inside it and the track around it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contrastRatio } from '@elirobinson/tokens/color';
import { COMBINATIONS, combinationValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(
  join(here, '..', 'src', 'components', 'molecules', 'SegmentedControl.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const TOKEN_SOURCES = readTokenStylesheets();

/** The body of the rule whose selector is exactly `selector`. */
function body(selector) {
  const rule = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
    (match) => match[1].trim() === selector,
  );
  expect(rule, `${selector} is missing from SegmentedControl.css`).toBeDefined();
  return rule[2];
}

/** The last custom property a declaration names, e.g. `--surface`. */
function token(selector, property) {
  const declaration = body(selector).match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+)`))?.[1];
  expect(declaration, `${selector} declares no ${property}`).toBeDefined();
  return [...declaration.matchAll(/--[\w-]+/g)].at(-1)?.[0];
}

const TRACK = token('.ds-segmented-control', 'background');
const FILL = token('.ds-segmented-control__item--active', 'background');
const RING = token('.ds-segmented-control__item--active', 'box-shadow');

it('reads the three tokens the selected state is made of', () => {
  expect(TRACK).toBe('--bg-subtle');
  expect(FILL).toBe('--surface');
  // The ring is the inset layer, and it is the last one named in the shadow.
  expect(body('.ds-segmented-control__item--active')).toMatch(/inset\s+0\s+0\s+0\s+1px\s+var\(--/);
  expect(RING).toBe('--border-control');
});

describe('the selected segment is marked by more than its fill', () => {
  for (const combination of COMBINATIONS) {
    const values = combinationValues(TOKEN_SOURCES, combination);
    const ratio = (fg, bg) => contrastRatio(values.get(fg), values.get(bg));

    it(`${combination.id}: the ring clears 3:1 against the selected fill`, () => {
      expect(ratio(RING, FILL)).toBeGreaterThanOrEqual(3);
    });

    it(`${combination.id}: the ring clears 3:1 against the track`, () => {
      expect(ratio(RING, TRACK)).toBeGreaterThanOrEqual(3);
    });
  }

  /* Why the ring exists. If this ever stops holding — a dark --surface that
     separates from the track by itself — the ring may no longer be needed,
     and this is where that shows up. */
  it('in dark, the selected fill is indistinguishable from the track', () => {
    const dark = combinationValues(TOKEN_SOURCES, { palette: 'ember', theme: 'dark' });
    expect(contrastRatio(dark.get(FILL), dark.get(TRACK))).toBeLessThan(1.1);
  });
});
