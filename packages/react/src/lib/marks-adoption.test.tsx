/* The six controls #166 names actually paint a mark, and typeset no character.
 *
 * scripts/marks.test.mjs proves the marks themselves are correct — centred in
 * their viewBox, the chevron pair a true reflection, the element hidden from
 * assistive technology. What it does not do is render a component: it never
 * imports one, so every assertion in it would pass just as well on a library
 * where nothing had adopted the mark at all.
 *
 * That is the gap this closes, and it is the issue's first acceptance criterion
 * — "one reusable mark, used by all six controls". Asserted on rendered output
 * rather than by grepping for the import, because a component can import `Mark`
 * and still leave a character somewhere else in its tree, which is exactly the
 * state #166 moved the library out of.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Chip } from '../components/molecules/Chip.js';
import { Pagination } from '../components/molecules/Pagination.js';
import { Rating } from '../components/molecules/Rating.js';
import { SearchField } from '../components/molecules/SearchField.js';
import { DatePicker } from '../components/organisms/DatePicker.js';
import { Toast } from '../components/organisms/Toast.js';

/* The characters these controls used to typeset. If one comes back, the control
   has regressed to a font-dependent glyph — and it would still have a mark in
   the tree, so checking only for marks would not see it. */
const TYPESET_GLYPHS = /[×✕✖★☆‹›]/;

const noop = () => {};

const CONTROLS: Array<[string, () => HTMLElement, number]> = [
  ['Chip', () => render(<Chip onRemove={noop}>Tag</Chip>).container, 1],
  ['SearchField', () => render(<SearchField defaultValue="q" aria-label="Search" />).container, 1],
  ['Toast', () => render(<Toast onDismiss={noop}>Saved</Toast>).container, 1],
  ['Rating, interactive', () => render(<Rating value={3} onValueChange={noop} />).container, 5],
  ['Rating, read-only', () => render(<Rating value={3} />).container, 5],
  [
    'Pagination',
    () => render(<Pagination page={2} pageCount={5} onPageChange={noop} />).container,
    2,
  ],
  [
    /* `defaultOpen` rather than a click: #177 gave the picker that prop, so the
       month header is reachable without driving the component. */
    'DatePicker',
    () =>
      render(
        <DatePicker
          label="Start date"
          value={new Date(2026, 7, 26)}
          onValueChange={noop}
          defaultOpen
        />,
      ).container,
    2,
  ],
];

describe('every control that #166 converted paints a drawn mark', () => {
  for (const [name, mount, expected] of CONTROLS) {
    it(`${name} paints ${expected} mark${expected === 1 ? '' : 's'} and typesets none`, () => {
      const container = mount();

      /* The count, not just "more than zero": a Rating that painted one star
         for five values, or a Pagination that converted `‹` and left `›`, is
         half-converted and would pass a presence check. */
      expect(container.querySelectorAll('svg.ds-mark')).toHaveLength(expected);
      expect(container.textContent ?? '').not.toMatch(TYPESET_GLYPHS);
    });
  }

  it('still recognises a typeset glyph — the pattern has not gone stale', () => {
    /* The loop above only ever sees text that is already clean, so on its own
       it cannot show the check would fire. */
    expect(TYPESET_GLYPHS.test('‹')).toBe(true);
    expect(TYPESET_GLYPHS.test('★')).toBe(true);
    expect(TYPESET_GLYPHS.test('August 2026')).toBe(false);
  });
});
