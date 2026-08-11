import type { Ref, RefCallback } from 'react';
import { useCallback } from 'react';

/**
 * Internal. A single `ref` prop can only point one direction, but a component
 * that both forwards a consumer's ref and needs the node itself has two
 * destinations for one node. This merges them.
 *
 * Not exported from the package: consumers compose our components rather than
 * re-implementing their internals, so there is no import path that would need
 * it. Promote it to `src/hooks/` if that ever stops being true.
 */

type RefCleanup = () => void;

/**
 * Points one ref at `node` and returns how to undo that. React 19 lets a
 * callback ref return its own cleanup; when it does, that is what detaches it,
 * and when it does not we fall back to the legacy `ref(null)` call React would
 * otherwise make for us.
 */
function attach<T>(ref: Ref<T> | undefined, node: T | null): RefCleanup | undefined {
  if (typeof ref === 'function') {
    const cleanup: unknown = ref(node);
    return typeof cleanup === 'function' ? (cleanup as RefCleanup) : () => ref(null);
  }

  if (ref) {
    const box = ref as { current: T | null };
    box.current = node;
    return () => {
      box.current = null;
    };
  }

  return undefined;
}

/**
 * Memoized callback ref that writes `node` to both `a` and `b`.
 *
 * The result is stable across renders for stable inputs, which is what keeps
 * React from detaching and re-attaching the ref on every render. It returns a
 * cleanup, so every merged ref — object, legacy callback, or React 19
 * cleanup-returning callback — is released together on detach.
 */
export function useMergedRef<T>(a: Ref<T> | undefined, b: Ref<T> | undefined): RefCallback<T> {
  return useCallback(
    (node: T | null) => {
      const cleanups = [attach(a, node), attach(b, node)];
      return () => {
        for (const cleanup of cleanups) {
          cleanup?.();
        }
      };
    },
    [a, b],
  );
}
