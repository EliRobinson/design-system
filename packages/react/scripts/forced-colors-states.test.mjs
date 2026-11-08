/* Selected and active states in forced-colors mode (Windows High Contrast), #291.
 *
 * Forced colors drops background and box-shadow, so a state drawn only with a
 * fill looks like every other item. Each state below opts out with
 * `forced-color-adjust: none` and paints itself in system colours, the same
 * shape as SegmentedControl (#253). jsdom cannot emulate `forced-colors`, so
 * this reads the shipped stylesheets.
 *
 * Where a base `:hover` rule outranks the state rule, the hover selector is in
 * the list too: once the item opts out, that hover rule would repaint it with
 * its normal-mode fill.
 */

import { describe, expect, it } from 'vitest';

import { forcedColorsRules, sheet } from './component-tokens.mjs';

/* The declarations of the forced-colors rule whose selector list names `selector`. */
function declarations(path, selector) {
  const rule = forcedColorsRules(sheet(path)).find((entry) =>
    entry.selector.split(',').some((part) => part.trim() === selector),
  );
  return rule?.body ?? '';
}

const HIGHLIGHTED = [
  ['Pagination', 'molecules/Pagination.css', ['.ds-pagination__item--active']],
  [
    'DatePicker',
    'organisms/DatePicker.css',
    ['.ds-date-picker__day--selected', '.ds-date-picker__day--selected:hover'],
  ],
  [
    'NavigationMenu',
    'organisms/NavigationMenu.css',
    ['.ds-navigation-menu__link--active', '.ds-navigation-menu__link--active:hover'],
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
  const css = sheet(path);

  it('puts the forced-colors block after the base rules', () => {
    /* component-tokens.mjs reads the first rule for a selector. */
    const block = css.indexOf('@media (forced-colors: active)');
    expect(block).toBeGreaterThan(css.indexOf(`${selectors[0]} {`));
  });

  it.each(selectors)('paints %s with Highlight and HighlightText', (selector) => {
    const body = declarations(path, selector);
    expect(body).toMatch(/forced-color-adjust:\s*none/);
    expect(body).toMatch(/background:\s*Highlight\b/);
    expect(body).toMatch(/color:\s*HighlightText\b/);
  });
});

describe('edges that would keep a normal-mode colour after opting out', () => {
  it('Pagination: the active border matches the fill', () => {
    expect(declarations('molecules/Pagination.css', '.ds-pagination__item--active')).toMatch(
      /border-color:\s*Highlight\b/,
    );
  });

  it('Stepper: the active ring matches the fill', () => {
    expect(
      declarations('molecules/Stepper.css', '.ds-stepper__step--active .ds-stepper__indicator'),
    ).toMatch(/border-color:\s*Highlight\b/);
  });

  it('CommandPalette: the active row keeps an inset ring, not a border', () => {
    const body = declarations('organisms/CommandPalette.css', '.ds-command-palette__item--active');
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
  ['Pagination', 'molecules/Pagination.css', '.ds-pagination__item:focus-visible'],
  ['DatePicker', 'organisms/DatePicker.css', '.ds-date-picker__day:focus-visible'],
  ['NavigationMenu', 'organisms/NavigationMenu.css', '.ds-navigation-menu__link:focus-visible'],
])('%s focus', (_name, path, selector) => {
  it('keeps focus visible with a system colour', () => {
    expect(declarations(path, selector)).toMatch(/outline-color:\s*CanvasText\b/);
  });
});
