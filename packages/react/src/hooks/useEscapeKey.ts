import type { ReactNode, RefObject } from 'react';
import { createContext, createElement, useContext, useEffect, useState } from 'react';

import { useLatest } from '../lib/useLatest.js';

/* One shared dismissal stack (#305). Every open layer — a tooltip, a popover, a
 * menu, a modal — sits on it, and one document listener hands an Escape to the
 * top entry only. Before this each layer listened by itself, so one keypress
 * closed every layer that was open. */

declare const escapeLayer: unique symbol;

/**
 * A place on the dismissal stack, as `useEscapeKey` returns it. Opaque: the
 * only thing to do with one is hand it to `EscapeLayerProvider`.
 */
export type EscapeLayer = { readonly [escapeLayer]: true };

/**
 * One entry on the stack. `parent` is the layer this one was rendered inside,
 * read from React context, so it holds across portals.
 */
type Layer = EscapeLayer & {
  readonly parent: Layer | null;
  /** Holds `null` for a layer the browser closes itself (a modal <dialog>). */
  readonly onEscape: RefObject<(() => void) | null>;
};

const stack: Layer[] = [];

function isDescendant(layer: Layer, ancestor: Layer) {
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
  // Deliberate. A browser closes a modal <dialog> on an Escape keydown that
  // nobody cancelled, so this is what keeps a dialog under this layer open.
  event.preventDefault();
  dismiss();
}

function push(layer: Layer) {
  // Effects run child first, so a layer that opened in the same commit as one
  // rendered inside it registers after it. It goes below its descendants.
  const firstDescendant = stack.findIndex((entry) => isDescendant(entry, layer));
  stack.splice(firstDescendant === -1 ? stack.length : firstDescendant, 0, layer);
  if (stack.length === 1) {
    document.addEventListener('keydown', handleKeyDown);
  }
}

function remove(layer: Layer) {
  const index = stack.indexOf(layer);
  if (index !== -1) {
    stack.splice(index, 1);
  }
  if (stack.length === 0) {
    document.removeEventListener('keydown', handleKeyDown);
  }
}

const EscapeLayerContext = createContext<Layer | null>(null);

/**
 * Makes `layer` the parent of every layer rendered inside it. A layer that
 * holds other overlays (a popover, a menu, a modal) wraps its content in this.
 * A tooltip does not: its trigger's children are not drawn above it.
 */
export function EscapeLayerProvider({
  value,
  children,
}: {
  value: EscapeLayer;
  children?: ReactNode;
}) {
  return createElement(EscapeLayerContext.Provider, { value: value as Layer }, children);
}

function useLayer(onEscape: (() => void) | null, enabled: boolean): EscapeLayer {
  const parent = useContext(EscapeLayerContext);
  // Callers write this callback inline, so keeping it out of the effect's
  // dependencies is what stops the layer moving to the top on every render.
  // Same reasoning as useClickOutside.
  const latest = useLatest(onEscape);
  // State, not a memo: the layer's identity is its place on the stack, and
  // React may drop a memoized value and hand back a new one. The parent is
  // the enclosing layer's own state, so it lasts as long as this one does.
  const [layer] = useState(() => ({ parent, onEscape: latest }) as Layer);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    push(layer);
    return () => remove(layer);
  }, [enabled, layer]);

  return layer;
}

/**
 * Puts a layer on the dismissal stack while `enabled`. `onEscape` runs only
 * when an Escape reaches this layer as the topmost one and nothing inside it
 * has cancelled the keydown already.
 */
export function useEscapeKey(onEscape: () => void, enabled = true): EscapeLayer {
  return useLayer(onEscape, enabled);
}

/**
 * Holds a place on the stack, while `enabled`, for a layer the browser
 * dismisses on Escape itself: a modal <dialog>. Nothing underneath it closes,
 * and a layer opened inside it cancels the keydown so the dialog stays open.
 */
export function useNativeEscapeLayer(enabled: boolean): EscapeLayer {
  return useLayer(null, enabled);
}
