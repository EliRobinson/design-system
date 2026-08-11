import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Internal. Keeps a ref pointed at the most recent render's value.
 *
 * The reason this exists is dependency arrays. A hook that attaches a document
 * listener wants that listener attached once, but the callback it should invoke
 * is written inline by the caller and so has a new identity every render.
 * Reading the callback from here at event time keeps it out of the effect's
 * dependencies without ever calling a stale one.
 *
 * The write happens in an effect, so the ref trails the current render until
 * the commit is finished. That is the right trade for this use: everything that
 * reads it — DOM event handlers, callbacks invoked from other effects — runs
 * after effects have flushed. Do not use it for a value read during render.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  });

  return ref;
}
