import { useEffect } from 'react';

import { containsTarget } from '../lib/containsTarget.js';
import { useLatest } from '../lib/useLatest.js';
import type { EscapeLayer, LayerNodes } from './useEscapeKey.js';
import { isInsideLayer } from './useEscapeKey.js';

/**
 * Calls `onClickOutside` on a mousedown outside `inside`: a list of nodes, or
 * a layer from `useEscapeKey`. Pass the layer when overlays can open inside
 * it: a click in their panels is then not outside, wherever a portal put them.
 */
export function useClickOutside(
  inside: LayerNodes | EscapeLayer,
  onClickOutside: () => void,
  enabled = true,
) {
  // Every caller passes a fresh array literal and a fresh closure, so having
  // either in the listener effect's dependencies would tear down and re-attach
  // the document listener on every render. The ref objects inside the array are
  // themselves stable, so nothing is lost by not observing the array.
  const latest = useLatest({ inside, onClickOutside });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const { inside: current, onClickOutside: notify } = latest.current;
      const isInside = Array.isArray(current)
        ? containsTarget(current, target)
        : isInsideLayer(current as EscapeLayer, target);
      if (!isInside) {
        notify();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [enabled, latest]);
}
