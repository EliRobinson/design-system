import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';

export type RovingFocusOptions = {
  /**
   * The navigable elements, in the order a user should traverse them. Called
   * on each key press rather than captured once, so it stays correct as items
   * are added, removed, or disabled. Return only focusable items — anything
   * this returns is treated as a valid stop.
   */
  getItems: () => HTMLElement[];
  /** Invoked with the item the key press moved to. */
  onNavigate: (index: number, item: HTMLElement) => void;
};

/**
 * Arrow/Home/End traversal for a composite widget that exposes a single tab
 * stop (a "roving tabindex"): Tab moves into the widget, arrows move within
 * it.
 *
 * Both axes are accepted because the same widget can be laid out either way
 * and a user should not have to guess which; movement wraps at both ends,
 * per the WAI-ARIA authoring practices for tabs and radio groups.
 *
 * Only the traversal is shared. What a move *means* differs by widget — tabs
 * move focus without selecting, radio-style groups select as they move — so
 * that decision stays with the caller in `onNavigate`.
 */
export function useRovingFocus({ getItems, onNavigate }: RovingFocusOptions) {
  return useCallback(
    (event: KeyboardEvent) => {
      const items = getItems();
      if (items.length === 0) {
        return;
      }

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      if (currentIndex === -1) {
        return;
      }

      let nextIndex: number;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % items.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + items.length) % items.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      onNavigate(nextIndex, items[nextIndex]);
    },
    [getItems, onNavigate],
  );
}
