/* SegmentedControl in forced-colors mode (Windows High Contrast), #253.
 *
 * Forced colors replaces background, box-shadow and colour with system
 * colours. The selected segment is drawn with a fill and a shadow ring, so it
 * would look like the others. jsdom cannot emulate `forced-colors`, and this
 * package has no browser test path, so this reads the shipped stylesheet and
 * asserts the forced-colors block carries the state in system colours.
 */

import { expect, it } from 'vitest';

import { rules, sheet } from './component-tokens.mjs';

const css = sheet('molecules/SegmentedControl.css');

/* Body of the first `@media (forced-colors: active) { ... }` block. */
function forcedColorsBlock() {
  const start = css.indexOf('@media (forced-colors: active)');
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
}

const block = forcedColorsBlock();

const declarations = (selector) =>
  rules(block).find((rule) => rule.selector === selector)?.body ?? '';

it('has a forced-colors block', () => {
  expect(block).not.toBe('');
});

it('paints the selected segment with Highlight and HighlightText', () => {
  const body = declarations('.ds-segmented-control__item--active');
  expect(body).toMatch(/background:\s*Highlight\b/);
  expect(body).toMatch(/color:\s*HighlightText\b/);
  expect(body).toMatch(/forced-color-adjust:\s*none/);
});

it('gives the selected segment an inset ring, not a border that would resize it', () => {
  const body = declarations('.ds-segmented-control__item--active');
  expect(body).toMatch(/box-shadow:\s*inset 0 0 0 1px CanvasText\b/);
  expect(body).not.toMatch(/\bborder\b/);
});

it('keeps focus visible with a system colour', () => {
  expect(declarations('.ds-segmented-control__item:focus-visible')).toMatch(
    /outline-color:\s*CanvasText\b/,
  );
});
