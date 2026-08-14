import { useCallback, useState } from 'react';

import { useLatest } from '../lib/useLatest.js';

export type UseDisclosureOptions = {
  /** Controlled open state. Passing it hands ownership of the value to the caller. */
  open?: boolean;
  /** Seeds the uncontrolled state. Ignored once `open` is supplied. */
  defaultOpen?: boolean;
  /** Notified of every requested change, controlled or not. */
  onOpenChange?: (open: boolean) => void;
};

export type Disclosure = {
  /** The resolved state: the `open` prop when controlled, internal state otherwise. */
  open: boolean;
  /** Requests a new state. Stable for the lifetime of the component. */
  setOpen: (open: boolean) => void;
};

/**
 * Open/closed state for a component that has to work both ways round: a
 * consumer either passes `open` and owns the value, or passes neither and lets
 * the component own it, seeded by `defaultOpen`.
 *
 * `open` resolves to the controlled prop whenever there is one and to internal
 * state otherwise, and `setOpen` writes internal state only in the
 * uncontrolled case while always reporting through `onOpenChange` — so a
 * controlled consumer never ends up fighting a second copy of the truth.
 *
 * `setOpen` keeps one identity for the component's lifetime; the current
 * `onOpenChange` is read from a ref at call time. That matters because the
 * dismissal hooks (`useClickOutside`, `useEscapeKey`) take a callback as a
 * dependency, and callers write that callback inline.
 */
export function useDisclosure({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: UseDisclosureOptions = {}): Disclosure {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const latest = useLatest({ isControlled, onOpenChange });

  const setOpen = useCallback(
    (next: boolean) => {
      if (!latest.current.isControlled) {
        setUncontrolledOpen(next);
      }
      latest.current.onOpenChange?.(next);
    },
    [latest],
  );

  return { open, setOpen };
}
