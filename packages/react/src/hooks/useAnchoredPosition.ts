import type { RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';

type Side = 'top' | 'bottom';
type Align = 'start' | 'center' | 'end';

export type AnchoredPositionOptions = {
  /** Which edge of the trigger the panel hangs from. Default `'bottom'`. */
  side?: Side;
  /**
   * `'start'` lines the panel's left edge up with the trigger's and gives it
   * the trigger's width as a minimum — the menu/listbox shape. `'end'` is the
   * same shape mirrored: the panel's *right* edge is pinned to the trigger's,
   * which is what a trigger near the right edge of the viewport needs.
   * `'center'` centres it on the trigger and leaves the width to the content,
   * which is what a tooltip wants. Default `'start'`.
   */
  align?: Align;
  /** CSS `z-index` value written onto the panel. Default `var(--z-overlay)`. */
  zIndex?: string;
};

/** The single gap between a trigger and anything anchored to it. */
const GAP = 4;

/**
 * The inline `min-width` for a start/end-aligned panel.
 *
 * "At least as wide as its trigger" is a floor, but an inline declaration
 * outranks the stylesheet, so writing the trigger's width here on its own
 * *deleted* the panel's own `min-width` — an icon or avatar trigger took
 * `.ds-dropdown__content`'s 180px down to 40px (#180).
 *
 * The number stays in CSS. A panel that wants a floor sets
 * `--anchored-min-width` beside its `min-width`, and `max()` resolves the two
 * in the browser; a panel that sets no floor falls back to `0px` and is sized
 * by its trigger exactly as before.
 */
function minWidthFor(triggerWidth: number) {
  return `max(var(--anchored-min-width, 0px), ${triggerWidth}px)`;
}

/**
 * Slides one pinned offset along its axis until the panel is inside the
 * viewport, and returns the offset to write.
 *
 * `offset` is the distance from the viewport edge the panel hangs off — a
 * `left`, a `right`, a `top`, a `bottom` — so the panel occupies
 * `offset` through `offset + size`, and the whole of it is on screen exactly
 * when `0 <= offset <= viewport - size`. Shifting is that clamp and nothing
 * more: the panel moves, it is never resized, so the width floor above and
 * the panel's own content width both survive it untouched.
 *
 * Unlike the flip above this cannot be latched, and does not need to be. Flip
 * is a choice between two placements, so leaving it free to change its mind
 * lets it chase a threshold it is sitting on. A shift is not a choice — it is
 * a function of the geometry in front of it, with no memory of the offset the
 * last pass wrote. Feed it the same rects and it returns the same answer, so
 * repositioning on every scroll event cannot walk the panel anywhere.
 *
 * The one feedback loop it does have is benign. A shrink-to-fit panel widens
 * when it is given more room, and shifting only ever gives it more room, so
 * across passes the measured width can only grow and the offset can only
 * fall — monotonic, bounded below by 0, and settled the moment the panel is
 * rendering at its natural width.
 *
 * `viewport - size` goes negative for a panel bigger than the viewport, and
 * the `max` then pins it flush against the edge it was already anchored to.
 */
function shiftIntoView(offset: number, size: number, viewport: number) {
  return Math.max(0, Math.min(offset, viewport - size));
}

/**
 * Positions a floating panel against its trigger with `position: fixed`, and
 * keeps it there while the page scrolls or the window resizes.
 *
 * Geometry is written straight to the node's inline style rather than held in
 * state: this runs in a layout effect, before paint, so the panel never shows
 * up in the wrong place first. The fourth argument accepts a bare side for the
 * common case (`'top'` / `'bottom'`) or an options object.
 *
 * A panel that does not fit on the side it asked for flips to the opposite one
 * — `bottom` to `top`, `start` to `end` — provided the opposite side has room.
 * Each axis flips at most once per open and never flips back, so the panel
 * cannot chase a threshold it is sitting on; `align: 'center'` is symmetric and
 * never flips. A panel that fits on *neither* side is shifted instead: it keeps
 * its width and slides along the axis until it is inside the viewport, so it
 * stops being edge-aligned with its trigger, and may overlap it, but it is
 * never narrowed into the room left beside a pinned edge and never reflows.
 * Only a panel taller than the viewport fits at no offset at all; that one
 * takes a `max-height` of the viewport and scrolls its own content.
 *
 * (The docs site renders the three paragraphs above and stops, so anything
 * a consumer has to know belongs there rather than here.)
 *
 * Shifting rather than clamping is the decision #195 asked for, and it is
 * decided by what a clamp would do: a `position: fixed` panel with no width is
 * shrink-to-fit, so capping its width does not crop it — it reflows the
 * content and wraps the labels, which is the squeeze #180 reported and reads
 * as a styling bug rather than a positioning one. Moving the panel sidesteps
 * the overflow-versus-wrap tradeoff entirely; the width floor `minWidthFor`
 * writes survives a shift untouched, because a shift resizes nothing. Unlike
 * the flip it is never latched — see `shiftIntoView` for why it does not need
 * to be, and why recomputing it on every reposition cannot walk the panel
 * across the screen. The one thing it cannot rescue horizontally is a panel
 * wider than the viewport, which is left flush against the edge it was pinned
 * to and overflows the other, because narrowing it is exactly what the floor
 * exists to prevent.
 *
 * The shift is measured from the panel's rendered box, and the pass is ordered
 * so that box is worth measuring — see the `position: fixed` written ahead of
 * the read. Every offset it then writes leaves the panel room for the width it
 * measured, so a panel placed by this hook is not squeezed into wrapping by
 * where it was put. What it cannot see is a panel that resizes itself while it
 * is open: nothing observes that, and it is corrected on the next scroll or
 * resize like everything else here.
 */
export function useAnchoredPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  options: Side | AnchoredPositionOptions = 'bottom',
) {
  const resolved = typeof options === 'string' ? { side: options } : options;
  const { side = 'bottom', align = 'start', zIndex = 'var(--z-overlay)' } = resolved;

  /* Each axis flips at most once, away from a side that does not fit and never
     back. That is what keeps a measure-then-reposition pass from oscillating:
     flipping changes the very measurement that caused it, so a decision free to
     move both ways can chase itself every frame at the threshold. One-way, the
     loop cannot close — and once an axis has settled there is nothing left to
     decide, so the measurement stops mattering. */
  const flippedSide = useRef(false);
  const flippedAlign = useRef(false);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    flippedSide.current = false;
    flippedAlign.current = false;

    function position() {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) {
        return;
      }

      /* The one declaration written before the measurement, because it decides
         what is being measured. A portalled panel that has not been positioned
         yet is a block-level box as wide as the body it was appended to, and
         every "does it fit?" question answered against that width answers
         wrong — a shift computed from it would drag every panel to the edge of
         the viewport on its first paint. Fixed, and with neither offset set
         yet, the panel is shrink-to-fit at its static position: its natural
         width, up to the viewport. On every later pass the property already
         holds this value, so nothing is invalidated and the read below flushes
         the same single layout it would have flushed anyway. */
      content.style.position = 'fixed';

      const rect = trigger.getBoundingClientRect();
      const panel = content.getBoundingClientRect();

      /* Read before any write of geometry. Both boxes are measured up front,
         and measuring them after writing offsets would read back what this
         pass had just set. */
      const roomBelow = window.innerHeight - rect.bottom - GAP;
      const roomAbove = rect.top - GAP;
      const roomFromLeft = window.innerWidth - rect.left;
      const roomFromRight = rect.right;

      if (!flippedSide.current) {
        const preferred = side === 'bottom' ? roomBelow : roomAbove;
        const opposite = side === 'bottom' ? roomAbove : roomBelow;
        /* Only worth flipping if the other side is actually better. A panel
           that fits nowhere stays where it was asked to go. */
        flippedSide.current = panel.height > preferred && panel.height <= opposite;
      }

      /* Centring is symmetric — there is no opposite edge to pin instead — so
         a tooltip is left exactly where it was. */
      if (align !== 'center' && !flippedAlign.current) {
        const preferred = align === 'start' ? roomFromLeft : roomFromRight;
        const opposite = align === 'start' ? roomFromRight : roomFromLeft;
        flippedAlign.current = panel.width > preferred && panel.width <= opposite;
      }

      /* `flippedAlign` only ever latches on a start/end panel, so the centred
         case needs no guard here. */
      const effectiveSide: Side = flippedSide.current
        ? side === 'bottom'
          ? 'top'
          : 'bottom'
        : side;
      const effectiveAlign: Align = flippedAlign.current
        ? align === 'start'
          ? 'end'
          : 'start'
        : align;

      content.style.zIndex = zIndex;

      // Exactly one horizontal edge is ever pinned. The other is released to
      // `auto`, because a fixed box given both a left and a right is stretched
      // between them rather than sized by its content.
      if (effectiveAlign === 'center') {
        /* Shifting is stated in terms of the edge that is on screen or not, so
           the centre is taken apart into a left edge, shifted, and put back
           together — `translateX(-50%)` is still what does the centring. */
        const centred = rect.left + rect.width / 2;
        const shifted = shiftIntoView(centred - panel.width / 2, panel.width, window.innerWidth);
        content.style.left = `${shifted + panel.width / 2}px`;
        content.style.right = 'auto';
        content.style.transform = 'translateX(-50%)';
      } else if (effectiveAlign === 'end') {
        // Measured back from the same viewport width the `bottom` case below
        // measures against, for the same reason: a classic scrollbar makes
        // `window.innerWidth` a few pixels generous, and one consistent frame
        // is worth more here than two subtly different ones.
        const pinned = window.innerWidth - rect.right;
        content.style.right = `${shiftIntoView(pinned, panel.width, window.innerWidth)}px`;
        content.style.left = 'auto';
        content.style.minWidth = minWidthFor(rect.width);
        content.style.transform = '';
      } else {
        content.style.left = `${shiftIntoView(rect.left, panel.width, window.innerWidth)}px`;
        content.style.right = 'auto';
        content.style.minWidth = minWidthFor(rect.width);
        content.style.transform = '';
      }

      if (effectiveSide === 'bottom') {
        content.style.top = `${shiftIntoView(rect.bottom + GAP, panel.height, window.innerHeight)}px`;
        content.style.bottom = 'auto';
      } else {
        const pinned = window.innerHeight - rect.top + GAP;
        content.style.bottom = `${shiftIntoView(pinned, panel.height, window.innerHeight)}px`;
        content.style.top = 'auto';
      }

      /* The one case no offset can rescue, so the only case that gets a clamp.
         Both properties are written on every pass — cleared to `''` rather
         than left behind — so a panel that grows past the viewport and shrinks
         back again gets its own stylesheet's height rules returned to it.

         `>=`, not `>`, is what keeps the clamp from fighting the shift. The
         next pass measures the box this one produced, and that box is exactly
         `innerHeight` tall: read as `>` it would count as fitting, be released,
         spring back to its full height, and be clamped again on the pass after
         — the same oscillation the flip latch exists to prevent, arrived at
         from the other direction. Clamping to the viewport exactly, and
         treating the clamped height as still too tall, makes the panel its own
         fixed point. */
      const tallerThanViewport = panel.height >= window.innerHeight;
      content.style.maxHeight = tallerThanViewport ? `${window.innerHeight}px` : '';
      content.style.overflowY = tallerThanViewport ? 'auto' : '';
    }

    position();

    // Fixed positioning is measured against the viewport, so any scroll or
    // resize invalidates it. Scroll is captured because the trigger may sit in
    // a scrollable ancestor, which does not bubble a scroll event to window.
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [open, triggerRef, contentRef, side, align, zIndex]);
}
