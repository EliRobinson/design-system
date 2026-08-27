// The drawn marks in src/lib/marks.tsx exist to remove an offset, and nothing
// measured whether they do. #146 established the pattern for one mark and #166
// added four more call sites to it, on the strength of a geometric argument
// written in a comment — which is exactly the kind of claim this repo turns
// into a test elsewhere (button-contrast.test.mjs resolves real ratios rather
// than trusting a number in a docblock).
//
// What is asserted here is the argument's premise: a mark's ink is centred on
// its control because the path's bounding box is centred in the viewBox, and
// round caps and joins grow that box equally on all four sides. The second half
// is a property of SVG. The first half is a property of the path data, it is
// what a careless edit breaks, and it is measurable without a browser — the
// numbers are right there in the `d` attribute.
//
// The parser below is deliberately a second implementation rather than an
// import of the module's own. mirrorX() parses the same strings; if both sides
// shared a parser, a bug in it would cancel out and the mirror test would pass
// on two identically-wrong readings.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(join(import.meta.dirname, '../src/lib/marks.tsx'), 'utf8');

/* The rendered `d` of every entry, read from the built module rather than
   scraped, so a derived path (chevron-left) is measured as it actually ships
   rather than as it is written. */
const { Mark } = await import('../src/lib/marks.tsx');

/* Every mark the module exposes, discovered rather than listed: a new entry
   that forgot to be added here would otherwise be a mark with no coverage,
   which is the failure this file exists to prevent. */
function markNames() {
  const block = source.slice(source.indexOf('const MARK_PATHS'), source.indexOf('} as const;'));
  const names = [...block.matchAll(/^ {2}'?([a-z-]+)'?:/gm)].map((m) => m[1]);

  if (names.length === 0) throw new Error('no MARK_PATHS entries found — has the shape changed?');

  return names;
}

/* Renders the mark and reads the `d` back out, which is how a derived path
   gets measured at all. Deliberately not a JSX render: this file runs under
   plain node, and the component is a single element whose props are readable
   straight off the returned object. */
function pathOf(name) {
  return Mark({ name }).props.children.props.d;
}

/* Bounding box of an absolute M/L path, from its coordinate pairs. Every entry
   in MARK_PATHS is polyline geometry, so the vertices are the extremes — no
   curve flattening to do, and a curve appearing here later would make this
   wrong in the safe direction: `Q`/`C` would throw on the command check below
   rather than be silently mis-measured. */
function boundingBox(d) {
  const commands = d.match(/[A-Za-z]/g) ?? [];
  const unsupported = commands.filter((c) => !'MLZmlz'.includes(c));

  expect(unsupported, `${d} uses path commands this measurement cannot read`).toEqual([]);
  expect(
    commands.some((c) => c === 'm' || c === 'l'),
    `${d} uses relative commands`,
  ).toBe(false);

  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

  expect(numbers.length % 2, `${d} has an odd number of coordinates`).toBe(0);

  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);

  return {
    x: [Math.min(...xs), Math.max(...xs)],
    y: [Math.min(...ys), Math.max(...ys)],
  };
}

const CENTRE = 8;

describe('every mark is centred in its viewBox', () => {
  /* The whole guarantee, and the reason a drawn mark replaced a typed glyph:
     zero residual rather than the 0.05px that Arial happened to give and the
     0.87px that Geist gave. A number close to 8 is a failure here — "close"
     is what the text glyphs already managed. */
  it.each(markNames())('%s paints its ink on the box centre', (name) => {
    const box = boundingBox(pathOf(name));

    expect((box.x[0] + box.x[1]) / 2, `${name} is off-centre horizontally`).toBe(CENTRE);
    expect((box.y[0] + box.y[1]) / 2, `${name} is off-centre vertically`).toBe(CENTRE);
  });

  /* A mark whose box is centred but tiny or oversized would pass the test
     above and still be wrong on screen — and a path that had lost its
     coordinates entirely would collapse to a point at (8, 8), which is
     perfectly centred.

     Bounded on the LONGER side only. This checked the shorter side too until
     `minus` was added: it is a single horizontal stroke, so its geometry is
     one-dimensional — every point sits at y = 8 — and it failed a floor of 3
     while being exactly the mark it should be. The check was measuring the
     wrong thing rather than finding a bad mark.

     Nothing is lost by dropping it. These marks are STROKED, so what a reader
     sees in the thin direction is the stroke width, not the geometry: a path
     0.5 units tall and one 0 units tall paint the same 1.5-unit bar once
     `stroke-linecap: round` has been applied. The shorter side therefore says
     almost nothing about what appears on screen. The collapse case the comment
     above is really about — a path whose coordinates are gone — has a longer
     side of 0 and is still caught here. */
  it.each(markNames())('%s fills a sane share of the box', (name) => {
    const box = boundingBox(pathOf(name));
    const longest = Math.max(box.x[1] - box.x[0], box.y[1] - box.y[0]);

    expect(longest, `${name} has collapsed, or is too small to read`).toBeGreaterThanOrEqual(3);
    expect(longest, `${name} overflows the box it is drawn in`).toBeLessThanOrEqual(14);
  });

  /* The floor the check above used to imply, kept as its own assertion so that
     dropping the shorter-side bound cannot quietly admit an empty path: a mark
     has to have at least one stroke in it. */
  it.each(markNames())('%s draws at least one line', (name) => {
    const d = pathOf(name);
    const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).length / 2;

    expect(
      numbers,
      `${name} has fewer than two points, so it paints nothing`,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('the derived chevron', () => {
  /* mirrorX() is the reason there is one chevron in the source and two in the
     roster. If it silently returned its input, the two nav buttons would show
     the same arrow pointing the same way — legible, plausible, and wrong. */
  it('points the other way from the one that was written', () => {
    expect(pathOf('chevron-left')).not.toBe(pathOf('chevron-right'));
  });

  it('is the exact reflection of it, so the pair cannot drift apart', () => {
    const right = (pathOf('chevron-right').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const left = (pathOf('chevron-left').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

    expect(left).toHaveLength(right.length);

    left.forEach((value, i) => {
      /* x reflects about the viewBox centre line; y is untouched. */
      expect(value).toBe(i % 2 === 0 ? 16 - right[i] : right[i]);
    });
  });
});

describe('the mark element itself', () => {
  it('is hidden from assistive technology, because its control is named', () => {
    /* Every call site is a button with its own aria-label. A mark that
       exposed itself would give those buttons a second name. */
    const element = Mark({ name: 'cross' });

    expect(element.props['aria-hidden']).toBe('true');
    expect(element.props.focusable).toBe('false');
  });

  it('carries the filled modifier only when asked', () => {
    /* The rating's two states differ by this class and nothing else, so a
       modifier that never landed would put the states back to colour-only —
       the SC 1.4.1 problem the star was drawn to keep fixed. */
    expect(Mark({ name: 'star' }).props.className).not.toContain('ds-mark--filled');
    expect(Mark({ name: 'star', filled: true }).props.className).toContain('ds-mark--filled');
  });
});
