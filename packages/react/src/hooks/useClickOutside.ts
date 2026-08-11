import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  onClickOutside: () => void,
  enabled = true,
) {
  // Every caller passes a fresh array literal and a fresh closure, so having
  // either in the listener effect's dependencies would tear down and re-attach
  // the document listener on every render. Reading both from a ref at event
  // time keeps the listener bound to `enabled` alone; the ref objects inside
  // the array are stable, so nothing is lost by not observing the array.
  const latest = useRef({ refs, onClickOutside });
  useEffect(() => {
    latest.current = { refs, onClickOutside };
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const { refs: current, onClickOutside: notify } = latest.current;
      const isInside = current.some((ref) => ref.current?.contains(target));
      if (!isInside) {
        notify();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [enabled]);
}
