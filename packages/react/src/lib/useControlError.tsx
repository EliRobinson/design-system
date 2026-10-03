import type { ReactNode } from 'react';
import { useId } from 'react';

export type ControlErrorProps = {
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

/**
 * The error wiring a labelled-row control (`Checkbox`, `Switch`) shares with
 * `Input`: `aria-invalid`, the caller's `aria-describedby` kept and the error's
 * id appended, and the same `ds-hint ds-hint--error` alert `Input` renders.
 *
 * `message` is a sibling of the row, never inside the `<label>`, so the error
 * stays out of the control's accessible name. It is `null` without an error,
 * so a control with no error renders the markup it always did.
 */
export function useControlError(
  error: string | undefined,
  ariaDescribedBy: string | undefined,
): { controlProps: ControlErrorProps; message: ReactNode } {
  const errorId = useId();

  return {
    controlProps: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby':
        [ariaDescribedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined,
    },
    message: error ? (
      <span id={errorId} className="ds-hint ds-hint--error" role="alert">
        {error}
      </span>
    ) : null,
  };
}
