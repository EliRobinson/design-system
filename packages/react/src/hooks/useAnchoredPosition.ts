import type { RefObject } from 'react';
import { useLayoutEffect } from 'react';

type Side = 'top' | 'bottom';

export function useAnchoredPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  side: Side = 'bottom',
) {
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!open || !trigger || !content) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const gap = 4;

    content.style.position = 'fixed';
    content.style.left = `${rect.left}px`;
    content.style.minWidth = `${rect.width}px`;
    content.style.zIndex = 'var(--z-overlay)';

    if (side === 'bottom') {
      content.style.top = `${rect.bottom + gap}px`;
      content.style.bottom = 'auto';
    } else {
      content.style.bottom = `${window.innerHeight - rect.top + gap}px`;
      content.style.top = 'auto';
    }
  }, [open, triggerRef, contentRef, side]);
}
