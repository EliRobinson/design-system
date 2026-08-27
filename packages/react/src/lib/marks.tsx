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
 * A drawn mark has no baseline and no metrics. It is a replaced element whose
 * box is its own size, blockified as a flex item and centred by the flex box
 * the control already has; the geometry inside the viewBox is symmetric about
 * its centre. So the ink centre is the box centre is the control's centre —
 * zero offset by construction rather than a small number that happened to come
 * out well. That is the whole reason this module exists.
 *
 * Adding a mark
 * -------------
 * Add an entry to `MARK_PATHS`. The contract every entry keeps:
 *
 * - a `0 0 16 16` viewBox, so one stylesheet sizes them all;
 * - **a path bounding box centred on (8, 8)**, which is what makes the centring
 *   exact;
 * - stroked, not filled, so `currentColor` carries every colour state the
 *   control already declares without a second rule.
 *
 * The second point used to read "geometry symmetric about (8, 8)", which is
 * true of a cross and describes why a cross works, but it is stricter than the
 * guarantee needs and it excludes marks that belong here — a chevron is not
 * symmetric about anything and is still exactly centred.
 *
 * What actually holds: `stroke-linecap` and `stroke-linejoin: round` make the
 * painted ink the set of points within half a stroke-width of the path, which
 * grows the bounding box by the same amount on all four sides and therefore
 * *leaves its centre where it was*. So a path whose own box is centred on
 * (8, 8) paints ink centred on (8, 8), for any shape at all. Round is load-
 * bearing in that sentence: a miter join spikes past the vertex by an amount
 * that depends on the angle, on one side only, and the centre moves.
 * `marks.test.mjs` measures the box of every entry rather than trusting this.
 *
 * `cross` is used by the chip's remove, the search field's clear and the
 * toast's close; `chevron-left`/`chevron-right` by pagination and the date
 * picker's month nav; `star` by the rating, in both its states.
 */

/* The chevron is written once, pointing right, and the left one is derived by
   reflecting it. Two hand-written chevrons would be two things to keep in
   agreement, and the failure mode of them drifting apart is a pair of nav
   buttons whose arrows are subtly different sizes — the kind of thing nobody
   sees and everybody feels.

   Reflecting about x = 8 is the viewBox's own centre line, so it maps a
   centred box onto a centred box: the invariant survives the derivation rather
   than having to be re-checked for the result.

   Only valid for paths built from absolute M/L pairs and Z, which is all of
   MARK_PATHS — every number is one coordinate of an x, y pair, so flipping the
   even-indexed ones flips the shape. `marks.test.mjs` asserts the pair really
   are mirror images, so a future entry that broke this assumption could not
   pass through here silently. */
function mirrorX(path: string): string {
  let index = 0;

  return path.replace(/-?\d+(?:\.\d+)?/g, (n) => {
    const flipped = index % 2 === 0 ? 16 - Number(n) : Number(n);
    index += 1;
    /* Trailing-zero-free, so a reflected coordinate reads like a written one
       and the two halves of the pair are comparable by eye. */
    return String(Number(flipped.toFixed(2)));
  });
}

const CHEVRON_RIGHT = 'M6 4 10 8 6 12';

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

  /* 4 wide by 8 tall: the 1:2 proportion a chevron is normally drawn at, and
     the box is centred because the apex at x = 10 is as far right of centre as
     the two arm ends at x = 6 are left of it. */
  'chevron-right': CHEVRON_RIGHT,
  'chevron-left': mirrorX(CHEVRON_RIGHT),

  /* The accordion's expand/collapse pair, and the last two marks in the library
     that were characters — `content: '+'` and `content: '\2212'` on
     `.ds-accordion__trigger::after`. #166 did not reach them because it listed
     six controls that render a real element, and a pseudo-element cannot hold
     an `<svg>`; the trigger had to start rendering one instead.

     5..11, which is `cross`'s extent rather than a number tuned for these.
     They are the same family drawn at the same scale, and matching a sibling is
     a rule that survives someone adding a seventh mark — measured at 6.75px of
     ink against the character `+`'s 7.00px at --fs-sm, so the quarter pixel
     that buys is not worth a bespoke extent.

     `minus` is the horizontal stroke of `plus`, which is what makes the pair
     read as one control changing state rather than two unrelated glyphs. Its
     bounding box is one-dimensional — every point is at y = 8 — and that is
     still centred: min and max agree, so the midpoint is 8. `stroke-linecap:
     round` then grows it symmetrically into a visible bar. */
  plus: 'M8 5 8 11M5 8 11 8',
  minus: 'M5 8 11 8',

  /* A regular five-pointed star, outer radius 7, inner radius at the regular
     ratio sin(18°)/sin(54°).

     The radius is not a taste call: at 5.6 the drawn star painted 13.33px tall
     against the 16.67px the ★ it replaces painted at the same --mark-size, and
     a rating row that quietly shrank by a fifth is a regression whoever reads
     the diff would not have asked for. 7 puts it at 16.68px — the same mark, a
     different way of drawing it.

     Positioned by its bounding box and not by its centroid, which for this
     shape are different points: one point stands above the centre while two
     stand below it, so the ink reaches 5.6 up and only 4.53 down. Centring the
     polygon — the obvious thing — would sit the star low in its box by about
     half a unit, and every rating star would be fractionally below the middle
     of its button. The vertices below are already translated so the box is
     centred; `marks.test.mjs` is what keeps that true. */
  star:
    'M8 1.67L9.57 6.51L14.66 6.51L10.54 9.49L12.11 14.33L8 11.34' +
    'L3.89 14.33L5.46 9.49L1.34 6.51L6.43 6.51Z',
} as const;

export type MarkName = keyof typeof MARK_PATHS;

export type MarkProps = Omit<SVGAttributes<SVGSVGElement>, 'children'> & {
  name: MarkName;
  /**
   * Paints the mark's interior as well as its outline.
   *
   * This is a *shape* difference and has to stay one. The rating's two states
   * were both `★` once, told apart by colour alone — SC 1.4.1, and the two
   * colours measured 2.66:1 apart against the 3:1 SC 1.4.11 asks between
   * adjacent meaningful graphics. An outline and a solid are legible as
   * different marks with no colour vision at all, which is the property being
   * preserved here; the colour difference the rating also declares is
   * reinforcement on top of it, not the channel.
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
export function Mark({ name, filled = false, className, ...props }: MarkProps) {
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
