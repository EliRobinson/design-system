import type { RefObject } from 'react';
import { useLayoutEffect } from 'react';

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
 * It does not flip or clamp the panel to stay inside the viewport — a panel
 * anchored near an edge can overflow it. Note that a `position: fixed` panel
 * with no width does not merely overflow: its shrink-to-fit width is capped by
 * whatever room is left beside the edge that is pinned, so the content reflows
 * instead. `align: 'end'` is the answer for the common right-edge trigger.
 */
export function useAnchoredPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  options: Side | AnchoredPositionOptions = 'bottom',
) {
  const resolved = typeof options === 'string' ? { side: options } : options;
  const { side = 'bottom', align = 'start', zIndex = 'var(--z-overlay)' } = resolved;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function position() {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) {
        return;
      }

      const rect = trigger.getBoundingClientRect();

      content.style.position = 'fixed';
      content.style.zIndex = zIndex;

      // Exactly one horizontal edge is ever pinned. The other is released to
      // `auto`, because a fixed box given both a left and a right is stretched
      // between them rather than sized by its content.
      if (align === 'center') {
        content.style.left = `${rect.left + rect.width / 2}px`;
        content.style.right = 'auto';
        content.style.transform = 'translateX(-50%)';
      } else if (align === 'end') {
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

      if (side === 'bottom') {
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
