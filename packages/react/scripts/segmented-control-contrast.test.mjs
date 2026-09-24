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

import { COMBINATIONS } from '@elirobinson/tokens/contrast';
import { describe, expect, it } from 'vitest';

import { ratio, rules, sheet, systemToken } from './component-tokens.mjs';

const SHEET = 'molecules/SegmentedControl.css';
const ACTIVE = '.ds-segmented-control__item--active';

const TRACK = systemToken(SHEET, '.ds-segmented-control', 'background');
const FILL = systemToken(SHEET, ACTIVE, 'background');
const RING = systemToken(SHEET, ACTIVE, 'box-shadow');

it('reads the three tokens the selected state is made of', () => {
  expect(TRACK).toBe('--bg-subtle');
  expect(FILL).toBe('--surface');
  // The ring is the inset layer, and it is the last one named in the shadow.
  const active = rules(sheet(SHEET)).find((rule) => rule.selector === ACTIVE);
  expect(active.body).toMatch(/inset\s+0\s+0\s+0\s+1px\s+var\(--/);
  expect(RING).toBe('--border-control');
});

describe('the selected segment is marked by more than its fill', () => {
  for (const { id } of COMBINATIONS) {
    it(`${id}: the ring clears 3:1 against the selected fill`, () => {
      expect(ratio(id, RING, FILL)).toBeGreaterThanOrEqual(3);
    });

    it(`${id}: the ring clears 3:1 against the track`, () => {
      expect(ratio(id, RING, TRACK)).toBeGreaterThanOrEqual(3);
    });
  }

  /* Why the ring exists. If this ever stops holding — a dark --surface that
     separates from the track by itself — the ring may no longer be needed,
     and this is where that shows up. */
  it('in dark, the selected fill is indistinguishable from the track', () => {
    expect(ratio('ember/dark', FILL, TRACK)).toBeLessThan(1.1);
  });
});
