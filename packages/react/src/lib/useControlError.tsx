import type { ReactNode } from 'react';
import { useId } from 'react';

import { FieldMessage, messageDescribedBy } from './FieldMessage.js';

export type ControlErrorProps = {
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

/**
 * The hint and error wiring of the labelled controls (`Input`, `Textarea`,
 * `Select`, `Checkbox`, `Switch`): `aria-invalid`, the caller's
 * `aria-describedby` kept first with the shown message's id appended, and the
 * `ds-hint` / `ds-hint ds-hint--error` slots from `FieldMessage`. The hint's id
 * is only appended while the hint is shown, so no id points at a missing node.
 *
 * Render `message` as a sibling after the control (for `Checkbox` and `Switch`,
 * after the `<label>` row, so the message stays out of the accessible name). It
 * is not a wrapper: wrapping only when there is an error would remount the input
 * when one appears and drop an uncontrolled value. Without a hint or an error it
 * renders nothing, so the control renders the markup it always did.
 */
export function useControlError(
  error: string | undefined,
  ariaDescribedBy: string | undefined,
  hint?: string,
): { controlProps: ControlErrorProps; message: ReactNode } {
  const hintId = useId();
  const errorId = useId();

  return {
    controlProps: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby':
        [ariaDescribedBy, messageDescribedBy(hint, error, hintId, errorId)]
          .filter(Boolean)
          .join(' ') || undefined,
    },
    message: (
      <FieldMessage
        as="span"
        hint={hint}
        error={error}
        hintId={hintId}
        errorId={errorId}
        hintClassName="ds-hint"
        errorClassName="ds-hint ds-hint--error"
      />
    ),
  };
}
