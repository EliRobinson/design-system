import type { ReactNode } from 'react';
import { useId } from 'react';

export type ControlErrorProps = {
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

/**
 * The error wiring of the labelled-row controls (`Checkbox`, `Switch`). It
 * follows the contract `Input` implements inline: `aria-invalid`, the caller's
 * `aria-describedby` kept with the error's id appended, and the same
 * `ds-hint ds-hint--error` alert.
 *
 * `message` is rendered as a sibling after the `<label>` row, not inside it,
 * so the error stays out of the control's accessible name. It is not a wrapper
 * either: wrapping only when there is an error would remount the input when
 * one appears and drop an uncontrolled check. It is `null` without an error, so
 * a control with no error renders the markup it always did. With an error the
 * control renders two nodes, so the parent's layout places the message.
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
