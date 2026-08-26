import type { SVGAttributes } from 'react';

import { cn } from './cn.js';

/**
 * The system's drawn marks: small decorative glyphs that a control paints
 * instead of setting as text.
 *
 * Why these are drawn rather than typed
 * -------------------------------------
 * A control like a chip's remove button used to render the literal character
 * `×`. That makes the control's rendering depend on a font, and on a `<button>`
 * it depends on a font nobody declared: `font-family` is not inherited — the UA
 * stylesheet sets it — so the glyph came out in the UA default while the label
 * beside it came out in Geist.
 *
 * Declaring the family fixes the typeface but not the geometry, and #146
 * measured why. `align-items: center` centres a text node's *line box*, and the
 * baseline sits `(ascent - descent) / 2` below that box's centre. Where the ink
 * then lands depends on where the family puts it relative to its own baseline —
 * so the same declaration centred the UA default's `×` to within 0.05px and
 * Geist's to within 0.87px. Neither number was designed; both were properties
 * of a font file. And a consumer may re-point `--font-sans`, which would move
 * the mark again, in a direction nobody here can predict.
 *
 * #167 has since given every native control `font-family: inherit`, so all six
 * of these characters are now Geist — which is to say the 0.87px case is the
 * one that ships. Measured on the two this file adds: the character `☆` sat
 * 0.25px above its button's centre and the character `‹` sat **1.125px** below
 * its own. Neither is tunable, for the reason above.
 *
 * A drawn mark has no baseline and no metrics. It is a replaced element whose
 * box is its own size, blockified as a flex item and centred by the flex box
 * the control already has; the geometry inside the viewBox is placed so its
 * bounding box is centred. So the ink centre is the box centre is the control's
 * centre — zero offset by construction rather than a small number that happened
 * to come out well. That is the whole reason this module exists.
 *
 * Adding a mark
 * -------------
 * Add an entry to `MARK_PATHS`. The contract every entry keeps:
 *
 * - a `0 0 16 16` viewBox, so one stylesheet sizes them all;
 * - **the path's bounding box centred on (8, 8)**, which is what makes the
 *   centring exact. `stroke-linecap` and `stroke-linejoin` are both `round`
 *   (marks.css), so the stroke grows the ink box by exactly half a stroke
 *   width on every side — a uniform expansion, which preserves a centred box.
 *   A `miter` join would not: it extends each vertex along its own bisector by
 *   an amount that depends on the angle, so a shape with unequal angles would
 *   come out off-centre.
 * - only `M`, `L` and `Z` — straight lines, absolute coordinates. The bounding
 *   box of a straight-line path is the extent of its own points, which is what
 *   lets marks.test.mjs verify the centring by arithmetic rather than in a
 *   browser. A curve's bounding box is not its control points, so adding one
 *   means moving that check to `getBBox()` and saying so here.
 * - stroked, not filled, so `currentColor` carries every colour state the
 *   control already declares without a second rule. `filled` is the one
 *   exception and it is a state, not a shape — see `star`.
 *
 * Symmetry is a convenience, not the rule. `cross` and the chevrons happen to
 * be symmetric about their centre; `star` is not and cannot be, because a
 * five-pointed star has one point up and two down. What all four share is a
 * centred bounding box, and that is the property being relied on.
 */
const MARK_PATHS = {
  /* Two strokes crossing at (8, 8). 5..11 rather than the viewBox's full 4..12
     because this replaces a text `×`, which is a small glyph inside its em —
     the wider cross reads as a close button on a dialog rather than as a chip's
     remove. Measured as painted pixels at --fs-sm: 6.75px of ink, against
     6.00px for Geist's own `×` and 6.13px for the UA default's, at the same
     declared size. Deliberately a little larger — the text `×` was on the light
     side for a control this small — and the difference is visible in the
     before/after shots rather than hidden. */
  cross: 'M5 5 11 11M11 5 5 11',

  /* A five-pointed star, outer radius 6.5 and inner 0.382 of it — the classic
     pentagram ratio, which is what makes it read as a star rather than as a
     flower or a spike.

     The points are generated from that radius and then TRANSLATED so the
     bounding box lands on (8, 8), which is not the same as putting the star's
     centre there: the shape spans `R` above its centre and only `0.809R` below,
     so a star centred on (8, 8) sits visibly high in its box. The offset is
     0.62 units, baked into the coordinates rather than applied at render time.

     Measured against the `★` it replaces, at --fs-lg in a 32px rating button:
     16.00 x 15.00px of ink against the character's 15.75 x 15.00 — the same
     mark, the same size — but centred to 0.000px where the character sat
     0.250px high. */
  star: 'M8 2.12L9.46 6.61L14.18 6.61L10.36 9.39L11.82 13.88L8 11.1L4.18 13.88L5.64 9.39L1.82 6.61L6.54 6.61Z',

  /* A directional pair, shipped as two paths rather than one path and a
     transform. Two reasons, in that order:

     the call site — a transform is a rule the CONTROL would have to carry
     ("this one is flipped"), and per-control geometry is the thing this module
     exists to remove. `name="chevron-left"` says what it is at the point of
     use, and neither control gains a stylesheet rule.

     the raster — a mirrored chevron is not quite the drawn one. Measured at
     8x device scale, `scaleX(-1)` differs from the drawn path in 18 of 16384
     subpixels and `rotate(180deg)` in 13, max delta 8/255. That is small
     enough to be invisible and large enough to be real, and it costs one line
     of path data to not have it. */
  'chevron-left': 'M10 4 6 8 10 12',
  'chevron-right': 'M6 4 10 8 6 12',
} as const;

export type MarkName = keyof typeof MARK_PATHS;

export type MarkProps = Omit<SVGAttributes<SVGSVGElement>, 'children'> & {
  name: MarkName;
  /**
   * Paint the interior as well as the outline.
   *
   * A state rather than a second shape, which is deliberate: `Rating` tells its
   * filled and empty stars apart by SHAPE, not by colour, because colour alone
   * is SC 1.4.1 and the two states measured only 2.66:1 apart — under the 3:1
   * SC 1.4.11 asks between adjacent meaningful graphics. Solid-versus-outline
   * is exactly the distinction `★` and `☆` carried, kept.
   *
   * The stroke stays on when filled, so both states have the same outer extent
   * and a row of stars does not change size as it fills.
   */
  filled?: boolean;
};

/**
 * A decorative mark. Always `aria-hidden`: every control that paints one
 * already carries its own accessible name, and a second one is noise in the
 * accessibility tree rather than help.
 *
 * Size comes from `--mark-size`, which the *control* sets from a token — the
 * mark does not choose its own size, because the same mark is 14px in a chip
 * and larger in a toast. See `.ds-mark` in marks.css.
 */
export function Mark({ name, filled, className, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('ds-mark', filled && 'ds-mark--filled', className)}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={MARK_PATHS[name]} />
    </svg>
  );
}

/**
 * The raw path data, for tests that verify the centring contract.
 *
 * Exported from here rather than duplicated in the test, so the thing asserted
 * is the thing that ships. Not part of the package's public API — `lib/` is not
 * in the exports map.
 */
export const MARK_GEOMETRY = MARK_PATHS;
