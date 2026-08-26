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
 * - **geometry symmetric about (8, 8)**, which is what makes the centring
 *   exact. `stroke-linecap: round` extends a stroke by half its width at each
 *   end, equally, so it preserves the symmetry — an asymmetric path would not,
 *   and would reintroduce exactly the offset this module removes;
 * - stroked, not filled, so `currentColor` carries every colour state the
 *   control already declares without a second rule.
 *
 * `cross` is used by `.ds-chip__remove` today; a search field's clear and a
 * toast's close are the same mark at a different size and adopt it next.
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
} as const;

export type MarkName = keyof typeof MARK_PATHS;

export type MarkProps = Omit<SVGAttributes<SVGSVGElement>, 'children'> & {
  name: MarkName;
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
export function Mark({ name, className, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('ds-mark', className)}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={MARK_PATHS[name]} />
    </svg>
  );
}
