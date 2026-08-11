import type { RefObject } from 'react';
import { useLayoutEffect } from 'react';

type Side = 'top' | 'bottom';
type Align = 'start' | 'center';

export type AnchoredPositionOptions = {
  /** Which edge of the trigger the panel hangs from. Default `'bottom'`. */
  side?: Side;
  /**
   * `'start'` lines the panel's left edge up with the trigger's and gives it
   * the trigger's width as a minimum — the menu/listbox shape. `'center'`
   * centres it on the trigger and leaves the width to the content, which is
   * what a tooltip wants. Default `'start'`.
   */
  align?: Align;
  /** CSS `z-index` value written onto the panel. Default `var(--z-overlay)`. */
  zIndex?: string;
};

/** The single gap between a trigger and anything anchored to it. */
const GAP = 4;

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
 * anchored near an edge can overflow it.
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

      if (align === 'center') {
        content.style.left = `${rect.left + rect.width / 2}px`;
        content.style.transform = 'translateX(-50%)';
      } else {
        content.style.left = `${rect.left}px`;
        content.style.minWidth = `${rect.width}px`;
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
