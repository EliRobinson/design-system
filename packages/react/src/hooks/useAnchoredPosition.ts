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
 * never flips. It does not *clamp*, though: a panel that fits on neither side
 * stays where it was asked to go, and a `position: fixed` panel with no width
 * does not merely overflow — its shrink-to-fit width is capped by whatever room
 * is left beside the pinned edge, so the content reflows instead. Give such a
 * panel a `--anchored-min-width` floor, or room. See #195.
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

      const rect = trigger.getBoundingClientRect();
      const panel = content.getBoundingClientRect();

      /* Read before any write. The panel's own box is the only thing measured
         here, and measuring it after writing geometry would read back what
         this pass had just set. */
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

      content.style.position = 'fixed';
      content.style.zIndex = zIndex;

      // Exactly one horizontal edge is ever pinned. The other is released to
      // `auto`, because a fixed box given both a left and a right is stretched
      // between them rather than sized by its content.
      if (effectiveAlign === 'center') {
        content.style.left = `${rect.left + rect.width / 2}px`;
        content.style.right = 'auto';
        content.style.transform = 'translateX(-50%)';
      } else if (effectiveAlign === 'end') {
        // Measured back from the same viewport width the `bottom` case below
        // measures against, for the same reason: a classic scrollbar makes
        // `window.innerWidth` a few pixels generous, and one consistent frame
        // is worth more here than two subtly different ones.
        content.style.right = `${window.innerWidth - rect.right}px`;
        content.style.left = 'auto';
        content.style.minWidth = minWidthFor(rect.width);
        content.style.transform = '';
      } else {
        content.style.left = `${rect.left}px`;
        content.style.right = 'auto';
        content.style.minWidth = minWidthFor(rect.width);
        content.style.transform = '';
      }

      if (effectiveSide === 'bottom') {
        content.style.top = `${rect.bottom + GAP}px`;
        content.style.bottom = 'auto';
      } else {
        content.style.bottom = `${window.innerHeight - rect.top + GAP}px`;
        content.style.top = 'auto';
      }
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
