import type { RefObject } from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';

import { useLatest } from '../lib/useLatest.js';

/* One shared dismissal stack (#305). Every open layer — a tooltip, a popover, a
 * menu, a modal — sits on it, and one document listener hands an Escape to the
 * top entry only. Before this each layer listened by itself, so one keypress
 * closed every layer that was open. */

/**
 * One entry on the stack. `parent` is the layer this one was rendered inside,
 * read from React context, so it holds across portals.
 */
export type EscapeLayer = {
  readonly parent: EscapeLayer | null;
  /** Holds `null` for a layer the browser closes itself (a modal <dialog>). */
  readonly onEscape: RefObject<(() => void) | null>;
};

const stack: EscapeLayer[] = [];

function isDescendant(layer: EscapeLayer, ancestor: EscapeLayer) {
  for (let parent = layer.parent; parent; parent = parent.parent) {
    if (parent === ancestor) {
      return true;
    }
  }
  return false;
}

function handleKeyDown(event: KeyboardEvent) {
  // A cancelled Escape was already used by something inside the top layer,
  // such as a Combobox closing its own listbox.
  if (event.key !== 'Escape' || event.defaultPrevented) {
    return;
  }
  const dismiss = stack.at(-1)?.onEscape.current;
  if (!dismiss) {
    // Let the browser cancel the modal <dialog>.
    return;
  }
  // Cancelling the keydown is what stops a browser closing a modal <dialog>
  // underneath this layer.
  event.preventDefault();
  dismiss();
}

function push(layer: EscapeLayer) {
  // Effects run child first, so a layer that opened in the same commit as one
  // rendered inside it registers after it. It goes below its descendants.
  const firstDescendant = stack.findIndex((entry) => isDescendant(entry, layer));
  stack.splice(firstDescendant === -1 ? stack.length : firstDescendant, 0, layer);
  if (stack.length === 1) {
    document.addEventListener('keydown', handleKeyDown);
  }
}

function remove(layer: EscapeLayer) {
  const index = stack.indexOf(layer);
  if (index !== -1) {
    stack.splice(index, 1);
  }
  if (stack.length === 0) {
    document.removeEventListener('keydown', handleKeyDown);
  }
}

const EscapeLayerContext = createContext<EscapeLayer | null>(null);

/**
 * Makes `layer` the parent of every layer rendered inside it. A layer that
 * holds other overlays (a popover, a menu, a modal) wraps its content in this.
 * A tooltip does not: its trigger's children are not drawn above it.
 */
export const EscapeLayerProvider = EscapeLayerContext.Provider;

/**
 * Puts a layer on the dismissal stack while `enabled`. `onEscape` runs only
 * when an Escape reaches this layer as the topmost one. Pass `null` for a
 * layer the browser dismisses itself: it still holds its place on the stack,
 * so nothing under it closes.
 */
export function useEscapeKey(onEscape: (() => void) | null, enabled = true): EscapeLayer {
  const parent = useContext(EscapeLayerContext);
  // Callers write this callback inline, so keeping it out of the effect's
  // dependencies is what stops the layer moving to the top on every render.
  // Same reasoning as useClickOutside.
  const latest = useLatest(onEscape);
  const layer = useMemo(() => ({ parent, onEscape: latest }), [parent, latest]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    push(layer);
    return () => remove(layer);
  }, [enabled, layer]);

  return layer;
}
