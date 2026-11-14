/* Selected and active states in forced-colors mode (Windows High Contrast),
 * #253 (SegmentedControl) and #291 (the rest).
 *
 * Forced colors drops background and box-shadow, so a state drawn only with a
 * fill looks like every other item. Each state below opts out with
 * `forced-color-adjust: none` and paints itself in system colours. jsdom
 * cannot emulate `forced-colors`, and this package has no browser test path,
 * so this reads the shipped stylesheets.
 *
 * Where a base `:hover` rule ties with the state rule, the hover selector is
 * in the list too: once the item opts out, that hover rule would repaint it
 * with its normal-mode fill. The opt-out is inherited, so a child that sets
 * its own colours is handed back to the system or repainted.
 */

import { describe, expect, it } from 'vitest';

import {
  FORCED_COLORS_QUERY,
  forcedColorsDeclarations as declarations,
  sheet,
} from './component-tokens.mjs';

/* True when the sheet's forced-colors block closes at the end of the sheet,
   so it follows every base rule it has to tie with or outrank. */
function forcedBlockIsLast(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '').trimEnd();
  const start = source.indexOf(FORCED_COLORS_QUERY);
  if (start === -1) return false;
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return i === source.length - 1;
  }
  return false;
}

const HIGHLIGHTED = [
  ['SegmentedControl', 'molecules/SegmentedControl.css', ['.ds-segmented-control__item--active']],
  ['Pagination', 'molecules/Pagination.css', ['.ds-pagination__item--active']],
  [
    'DatePicker',
    'organisms/DatePicker.css',
    ['.ds-date-picker__day--selected', '.ds-date-picker__day--selected:hover'],
  ],
  [
    'NavigationMenu',
    'organisms/NavigationMenu.css',
    ['.ds-navigation-menu .ds-navigation-menu__link.ds-navigation-menu__link--active'],
  ],
  [
    'CommandPalette',
    'organisms/CommandPalette.css',
    ['.ds-command-palette__item--active', '.ds-command-palette__item--active:hover'],
  ],
  ['Combobox', 'organisms/Combobox.css', ['.ds-combobox__option--active']],
  ['Stepper', 'molecules/Stepper.css', ['.ds-stepper__step--active .ds-stepper__indicator']],
];

describe.each(HIGHLIGHTED)('%s', (_name, path, selectors) => {
  it('ends the sheet with the forced-colors block', () => {
    /* Equal-specificity hover rules lose only to a later rule, and
       component-tokens.mjs reads the first rule for a selector. */
    expect(forcedBlockIsLast(sheet(path))).toBe(true);
  });

  it.each(selectors)('paints %s with Highlight and HighlightText', (selector) => {
    const body = declarations(path, selector);
    expect(body).toMatch(/forced-color-adjust:\s*none/);
    expect(body).toMatch(/background:\s*Highlight\b/);
    expect(body).toMatch(/color:\s*HighlightText\b/);
  });
});

describe('edges that would keep a normal-mode colour after opting out', () => {
  it.each([
    ['molecules/Pagination.css', '.ds-pagination__item--active'],
    ['molecules/Stepper.css', '.ds-stepper__step--active .ds-stepper__indicator'],
  ])('%s: the border joins the fill', (path, selector) => {
    expect(declarations(path, selector)).toMatch(/border-color:\s*Highlight\b/);
  });

  it.each([
    ['molecules/SegmentedControl.css', '.ds-segmented-control__item--active'],
    ['organisms/CommandPalette.css', '.ds-command-palette__item--active'],
    ['organisms/Combobox.css', '.ds-combobox__option--active'],
    [
      'organisms/NavigationMenu.css',
      '.ds-navigation-menu .ds-navigation-menu__link.ds-navigation-menu__link--active',
    ],
  ])('%s: keeps an inset ring, not a border that would resize it', (path, selector) => {
    const body = declarations(path, selector);
    expect(body).toMatch(/box-shadow:\s*inset 0 0 0 1px CanvasText\b/);
    expect(body).not.toMatch(/\bborder\b/);
  });

  it.each([
    '.ds-command-palette__item--active .ds-command-palette__detail',
    '.ds-command-palette__item--active:hover .ds-command-palette__detail',
  ])('CommandPalette: %s reads HighlightText', (selector) => {
    expect(declarations('organisms/CommandPalette.css', selector)).toMatch(
      /color:\s*HighlightText\b/,
    );
  });

  it('CommandPalette: the shortcut key caps go back to system colours', () => {
    /* Kbd sets its own fill, colour, border and shadow. */
    expect(
      declarations('organisms/CommandPalette.css', '.ds-command-palette__item--active .ds-kbd'),
    ).toMatch(/forced-color-adjust:\s*auto/);
  });
});

describe('states that sit beside a Highlight state', () => {
  it('Combobox: the chosen option has a CanvasText outline, apart from the active Highlight', () => {
    const body = declarations('organisms/Combobox.css', '.ds-combobox__option--selected');
    expect(body).toMatch(/outline:\s*1px solid CanvasText\b/);
    expect(body).not.toMatch(/\bborder\b/);
  });

  it('DatePicker: today keeps its ring as a CanvasText outline (box-shadow is dropped)', () => {
    expect(declarations('organisms/DatePicker.css', '.ds-date-picker__day--today')).toMatch(
      /outline:\s*1px solid CanvasText\b/,
    );
  });
});

/* An opted-out item keeps its outline on var(--focus-ring). */
describe.each([
  [
    'SegmentedControl',
    'molecules/SegmentedControl.css',
    '.ds-segmented-control__item:focus-visible',
  ],
  ['Pagination', 'molecules/Pagination.css', '.ds-pagination__item:focus-visible'],
  ['DatePicker', 'organisms/DatePicker.css', '.ds-date-picker__day:focus-visible'],
  [
    'NavigationMenu',
    'organisms/NavigationMenu.css',
    '.ds-navigation-menu .ds-navigation-menu__link:focus-visible',
  ],
])('%s focus', (_name, path, selector) => {
  it('keeps focus visible with a system colour', () => {
    expect(declarations(path, selector)).toMatch(/outline-color:\s*CanvasText\b/);
  });
});

it('NavigationMenu: the inset focus ring on the active link reads HighlightText', () => {
  /* The ring sits inside the Highlight fill, and only HighlightText is
     promised to contrast with it. */
  expect(
    declarations(
      'organisms/NavigationMenu.css',
      '.ds-navigation-menu .ds-navigation-menu__link--active:focus-visible',
    ),
  ).toMatch(/outline-color:\s*HighlightText\b/);
});
