import { useEffect } from 'react';
import type { RefObject } from 'react';

import { useLatest } from '../lib/useLatest.js';
import type { EscapeLayer } from './useEscapeKey.js';
import { isInsideNestedLayer } from './useEscapeKey.js';

/**
 * Calls `onClickOutside` on a mousedown outside every node in `refs`.
 *
 * Pass the caller's own `layer` (from `useEscapeKey`) when overlays can open
 * inside it. A mousedown in one of their panels is then not outside, though a
 * portal puts that panel elsewhere in the DOM.
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  onClickOutside: () => void,
  enabled = true,
  layer?: EscapeLayer,
) {
  // Every caller passes a fresh array literal and a fresh closure, so having
  // either in the listener effect's dependencies would tear down and re-attach
  // the document listener on every render. The ref objects inside the array are
  // themselves stable, so nothing is lost by not observing the array.
  const latest = useLatest({ refs, onClickOutside, layer });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const { refs: current, onClickOutside: notify, layer: own } = latest.current;
      const isInside =
        current.some((ref) => ref.current?.contains(target)) ||
        (own !== undefined && isInsideNestedLayer(own, target));
      if (!isInside) {
        notify();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [enabled, latest]);
}
