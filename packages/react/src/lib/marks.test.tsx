/* The drawn marks' centring contract, verified by arithmetic.
 *
 * #166's acceptance criterion is that each mark's ink is centred on its control
 * "by construction — zero residual, not a small one". That splits into two
 * claims, and this file is the first:
 *
 *   GEOMETRY — the path's bounding box is centred on (8, 8) exactly. No
 *   rendering involved, so "exactly" means exactly, with no rasterisation
 *   quantum to hide behind.
 *
 *   LAYOUT — the mark's box sits on the control's centre. That one needs a real
 *   browser and lives in `assertMarksCentred` in tests/visual/contracts.ts,
 *   which runs against every story.
 *
 * Keeping them apart matters, and so does the fact that NEITHER measures paint.
 * A painted measurement can only ever resolve to half a device pixel, so a test
 * that counted pixels could pass a mark 0.1 units off and call it zero — and it
 * would also report a false failure on any control that happens to land on a
 * fractional page position, because the rendered output snaps to the device
 * grid and the control snaps with it. Geometry plus layout is the claim that is
 * actually exact; contracts.ts says the same thing at more length.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Chip } from '../components/molecules/Chip.js';
import { Pagination } from '../components/molecules/Pagination.js';
import { Rating } from '../components/molecules/Rating.js';
import { SearchField } from '../components/molecules/SearchField.js';
import { DatePicker } from '../components/organisms/DatePicker.js';
import { Toast } from '../components/organisms/Toast.js';
import { Mark, MARK_GEOMETRY } from './marks.js';

/* Straight lines and absolute coordinates only — the contract marks.tsx states.
   It is what makes the bounding box below computable from the path's own
   numbers: for `M`/`L` every number pair IS a point on the shape, whereas a
   curve's control points lie outside it and would report a box the shape never
   reaches. Asserted rather than assumed, because the arithmetic silently
   becomes wrong the moment a `C` appears. */
const STRAIGHT_LINE_PATH = /^[MLZ0-9.\s-]+$/;

/** Every coordinate pair in a straight-line path. */
function points(d: string) {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  expect(numbers.length % 2, `${d} has an odd number of coordinates`).toBe(0);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < numbers.length; i += 2) {
    out.push([Number(numbers[i]), Number(numbers[i + 1])]);
  }
  return out;
}

const NAMES = Object.keys(MARK_GEOMETRY) as Array<keyof typeof MARK_GEOMETRY>;

describe('the mark geometry contract', () => {
  it('has marks to check — the roster has not gone empty', () => {
    // Every assertion below is a per-mark loop, so an empty roster would make
    // the whole file pass without checking anything.
    expect(NAMES).toEqual(
      expect.arrayContaining(['cross', 'star', 'chevron-left', 'chevron-right']),
    );
  });

  for (const name of NAMES) {
    describe(name, () => {
      const d = MARK_GEOMETRY[name];

      it('uses only straight lines and absolute coordinates', () => {
        expect(d, `${name} carries a command this file cannot measure`).toMatch(STRAIGHT_LINE_PATH);
      });

      it('has its bounding box centred on (8, 8)', () => {
        /* THE assertion. Everything else in this module — the round joins, the
           flex centring, `flex: none` — exists to carry this property from the
           path to the screen unchanged. */
        const pts = points(d);
        const xs = pts.map(([x]) => x);
        const ys = pts.map(([, y]) => y);

        expect((Math.min(...xs) + Math.max(...xs)) / 2, `${name} x centre`).toBe(8);
        expect((Math.min(...ys) + Math.max(...ys)) / 2, `${name} y centre`).toBe(8);
      });

      it('fits inside the viewBox once stroked', () => {
        /* stroke-width 1.5 grows the ink by 0.75 on every side. A path that
           reached the viewBox edge would have its stroke clipped — and clipping
           is asymmetric the moment it happens on one side only, which would
           break the centring this file just asserted. */
        const pts = points(d);
        const xs = pts.map(([x]) => x);
        const ys = pts.map(([, y]) => y);
        const HALF_STROKE = 0.75;

        expect(Math.min(...xs) - HALF_STROKE, `${name} overflows left`).toBeGreaterThanOrEqual(0);
        expect(Math.min(...ys) - HALF_STROKE, `${name} overflows top`).toBeGreaterThanOrEqual(0);
        expect(Math.max(...xs) + HALF_STROKE, `${name} overflows right`).toBeLessThanOrEqual(16);
        expect(Math.max(...ys) + HALF_STROKE, `${name} overflows bottom`).toBeLessThanOrEqual(16);
      });
    });
  }

  it('still catches an off-centre path — the arithmetic has not gone stale', () => {
    /* The check above is a loop over data that is currently all correct, so on
       its own it cannot show it would fail. This is the same computation run on
       a path that is deliberately wrong. */
    const offCentre = points('M4 4 10 10');
    const xs = offCentre.map(([x]) => x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBe(7);
    expect(STRAIGHT_LINE_PATH.test('M4 4C6 6 8 8 10 10')).toBe(false);
  });
});

describe('the Mark component', () => {
  it('is hidden from assistive technology', () => {
    /* Every control that paints a mark already has its own accessible name.
       A second one is noise in the tree, not help. */
    const { container } = render(<Mark name="cross" data-testid="m" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(screen.queryByTestId('m')).not.toBeNull();
  });

  it('declares the viewBox the stylesheet sizes against', () => {
    const { container } = render(<Mark name="star" />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 16 16');
  });

  it('paints the filled state as a state, not a different shape', () => {
    /* Rating tells its two states apart by shape — solid versus outline — for
       SC 1.4.1, and both must be the SAME path so the row does not resize as it
       fills. This asserts the path is shared and only the class differs. */
    const { container: empty } = render(<Mark name="star" />);
    const { container: full } = render(<Mark name="star" filled />);

    const emptySvg = empty.querySelector('svg');
    const fullSvg = full.querySelector('svg');

    expect(emptySvg?.querySelector('path')?.getAttribute('d')).toBe(
      fullSvg?.querySelector('path')?.getAttribute('d'),
    );
    expect(emptySvg?.classList.contains('ds-mark--filled')).toBe(false);
    expect(fullSvg?.classList.contains('ds-mark--filled')).toBe(true);
    expect(fullSvg?.classList.contains('ds-mark')).toBe(true);
  });

  it('renders nothing a screen reader has to skip past', () => {
    /* `aria-hidden` on the svg is only half of it — a `<title>` or stray text
       node inside would still be announced. The mark is one path and nothing
       else. */
    const { container } = render(<Mark name="chevron-left" />);
    const svg = container.querySelector('svg');
    expect(svg?.children).toHaveLength(1);
    expect(svg?.textContent).toBe('');
  });

  it('ships the directional pair as two paths, not one plus a transform', () => {
    /* A transform would be a rule the control carries, which is the per-control
       geometry this module exists to remove — and it is not free: measured at
       8x, scaleX(-1) differs from the drawn path in 18 of 16384 subpixels.
       If these two ever become the same path, that decision has been undone. */
    const { container: left } = render(<Mark name="chevron-left" />);
    const { container: right } = render(<Mark name="chevron-right" />);

    const leftPath = left.querySelector('path')?.getAttribute('d');
    const rightPath = right.querySelector('path')?.getAttribute('d');

    expect(leftPath).not.toBe(rightPath);
    for (const svg of [left.querySelector('svg'), right.querySelector('svg')]) {
      expect(svg?.getAttribute('style')).toBeNull();
      expect(svg?.getAttribute('transform')).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------------ *
 * Every control in #166's set actually adopted the mark
 * ------------------------------------------------------------------------ */

/* The issue names six controls, and "one reusable mark, used by all six" is its
 * first acceptance criterion. The geometry tests above would pass just as well
 * if only one control had adopted it, so this is what makes the set a set.
 *
 * Asserted on rendered output rather than by grepping for the import: a
 * component can import `Mark` and still typeset a character somewhere else, and
 * that is precisely the state this change moves the library out of.
 */
describe('the six controls #166 names', () => {
  /* The characters that used to be typeset. If one comes back, the control has
     regressed to a font-dependent glyph even if a mark renders elsewhere in the
     tree — which is why this checks the text as well as the marks. */
  const CHARACTERS = /[×✕✖★☆‹›]/;

  const cases: Array<[string, () => HTMLElement]> = [
    ['Chip', () => render(<Chip onRemove={() => {}}>Tag</Chip>).container],
    ['SearchField', () => render(<SearchField defaultValue="q" aria-label="Search" />).container],
    ['Toast', () => render(<Toast onDismiss={() => {}}>Saved</Toast>).container],
    ['Rating, interactive', () => render(<Rating value={3} onValueChange={() => {}} />).container],
    ['Rating, read-only', () => render(<Rating value={3} />).container],
    [
      'Pagination',
      () => render(<Pagination page={2} pageCount={5} onPageChange={() => {}} />).container,
    ],
  ];

  for (const [name, mount] of cases) {
    it(`${name} paints drawn marks and typesets no glyph`, () => {
      const container = mount();
      expect(container.querySelectorAll('svg.ds-mark').length).toBeGreaterThan(0);
      expect(container.textContent ?? '').not.toMatch(CHARACTERS);
    });
  }

  it('DatePicker paints drawn marks in its month header', async () => {
    /* The sixth control, and the only one behind an interaction: the header
       lives in a popover that opens on click. Worth the extra step — its `‹`
       was the worst-centred character in the set, 1.438px below the button's
       middle. */
    const user = userEvent.setup();
    const { container } = render(
      <DatePicker label="Start date" value={new Date(2026, 7, 26)} onValueChange={() => {}} />,
    );
    await user.click(screen.getByLabelText('Start date'));

    const header = container.querySelector('.ds-date-picker__header');
    expect(header, 'the calendar did not open').not.toBeNull();
    expect(header?.querySelectorAll('svg.ds-mark')).toHaveLength(2);
    expect(header?.textContent ?? '').not.toMatch(CHARACTERS);
  });

  it('still has a character to catch — the pattern has not gone stale', () => {
    expect(CHARACTERS.test('‹')).toBe(true);
    expect(CHARACTERS.test('August 2026')).toBe(false);
  });
});
