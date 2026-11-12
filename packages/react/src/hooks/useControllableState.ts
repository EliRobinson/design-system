import { useCallback, useState } from 'react';

import { useLatest } from '../lib/useLatest.js';

export type UseControllableStateOptions<T> = {
  /**
   * Controlled value. Passing anything other than `undefined` hands ownership
   * to the caller; `null` counts as a value, so a caller can control "nothing
   * selected".
   */
  value?: T;
  /**
   * Seeds the uncontrolled state, once. A function is called as a lazy
   * initialiser, as with `useState`, so `T` itself must not be a function.
   */
  defaultValue: T | (() => T);
  /** Notified of every requested change, controlled or not. */
  onChange?: (value: T) => void;
};

/**
 * State for a component that has to work both ways round: a consumer either
 * passes `value` and owns it, or omits it and lets the component own it,
 * seeded by `defaultValue`.
 *
 * The returned value is the controlled prop whenever there is one and internal
 * state otherwise. The setter writes internal state only in the uncontrolled
 * case and always reports through `onChange`, so a controlled consumer never
 * fights a second copy of the truth.
 *
 * The setter keeps one identity for the component's lifetime. The current mode
 * and `onChange` are read from a ref at call time, which lets callers put the
 * setter in effect and callback dependencies while writing `onChange` inline.
 *
 * Switching mode mid-life is allowed and silent. Going controlled to
 * uncontrolled shows whatever internal state held before control began, since
 * the setter never writes it while controlled. A component whose consumers are
 * likely to switch by mistake should warn itself, in its own words.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: UseControllableStateOptions<T>): [T, (next: T) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : uncontrolledValue;

  const latest = useLatest({ isControlled, onChange });

  const setValue = useCallback(
    (next: T) => {
      if (!latest.current.isControlled) {
        setUncontrolledValue(next);
      }
      latest.current.onChange?.(next);
    },
    [latest],
  );

  return [current, setValue];
}
