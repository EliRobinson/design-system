/* SegmentedControl in forced-colors mode (Windows High Contrast), #253.
 *
 * Forced colors replaces background, box-shadow and colour with system
 * colours. The selected segment is drawn with a fill and a shadow ring, so it
 * would look like the others. jsdom cannot emulate `forced-colors`, and this
 * package has no browser test path, so this reads the shipped stylesheet and
 * asserts the forced-colors block carries the state in system colours.
 */

import { expect, it } from 'vitest';

import { sheet } from './component-tokens.mjs';

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

function declarations(selector) {
  const match = block.match(new RegExp(`${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
}

it('has a forced-colors block', () => {
  expect(block).not.toBe('');
});

it('paints the selected segment with Highlight and HighlightText', () => {
  const body = declarations('.ds-segmented-control__item--active');
  expect(body).toMatch(/background:\s*Highlight\b/);
  expect(body).toMatch(/color:\s*HighlightText\b/);
  expect(body).toMatch(/forced-color-adjust:\s*none/);
});

it('gives the selected segment a border that survives forced colors', () => {
  const body = declarations('.ds-segmented-control__item--active');
  expect(body).toMatch(/border:\s*1px solid\s*(Highlight|CanvasText)\b/);
});

it('keeps focus visible with a system colour', () => {
  expect(declarations('.ds-segmented-control__item:focus-visible')).toMatch(
    /outline:\s*2px solid\s*(Highlight|CanvasText)\b/,
  );
});
