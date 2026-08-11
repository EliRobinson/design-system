import { useEffect, useRef } from 'react';

export function useEscapeKey(onEscape: () => void, enabled = true) {
  // Callers write this callback inline, so keeping it out of the listener
  // effect's dependencies is what stops the document listener being re-attached
  // on every render. Same reasoning as useClickOutside.
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        latest.current();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
