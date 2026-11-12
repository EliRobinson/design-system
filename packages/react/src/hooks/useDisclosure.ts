import { useControllableState } from './useControllableState.js';

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
 * Open/closed state for a component that has to work both ways round. It is
 * `useControllableState` for a boolean, named for overlays: `open` and
 * `setOpen` instead of a tuple, and closed unless `defaultOpen` says otherwise.
 *
 * `setOpen` keeps one identity for the component's lifetime. That matters
 * because the dismissal hooks (`useClickOutside`, `useEscapeKey`) take a
 * callback as a dependency, and callers write that callback inline.
 */
export function useDisclosure({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: UseDisclosureOptions = {}): Disclosure {
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return { open, setOpen };
}
