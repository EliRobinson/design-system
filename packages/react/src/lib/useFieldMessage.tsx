import type { ReactNode } from 'react';
import { useId } from 'react';

import type { MessageVariant } from './MessageSlot.js';
import { MessageSlot } from './MessageSlot.js';

export type FieldMessageControlProps = {
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

export type FieldMessageOptions = {
  error?: string;
  hint?: string;
  /** The caller's own `aria-describedby`. It comes first. */
  ariaDescribedBy?: string;
  variant?: MessageVariant;
};

/**
 * The hint and error of every labelled control: the message slots and the
 * control's `aria-invalid` and `aria-describedby`. Internal: not exported from
 * the package. `FieldError` is the public face of its error slot.
 *
 * At most one message shows, so both slots share one id, and the control is
 * described by it only while one is rendered: no id points at a missing node.
 * The caller's own `aria-describedby` comes first.
 *
 * Two slots, not one ternary: a hint turning into an error must mount a fresh
 * `role="alert"` element. Reusing the hint's node would add the role and the
 * text in one commit, and a live region that did not exist before the change
 * is not reliably announced.
 *
 * Render `message` as a sibling after the control (for `Checkbox` and `Switch`,
 * after the `<label>` row, so the message stays out of the accessible name). It
 * is not a wrapper: wrapping only when there is an error would remount the input
 * when one appears and drop an uncontrolled value. Without a hint or an error it
 * renders nothing, so the control renders the markup it always did.
 */
export function useFieldMessage({
  error,
  hint,
  ariaDescribedBy,
  variant = 'field',
}: FieldMessageOptions): { controlProps: FieldMessageControlProps; message: ReactNode } {
  const id = useId();

  return {
    controlProps: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby':
        [ariaDescribedBy, error || hint ? id : null].filter(Boolean).join(' ') || undefined,
    },
    message: (
      <>
        {hint && !error ? (
          <MessageSlot id={id} variant={variant} tone="hint">
            {hint}
          </MessageSlot>
        ) : null}
        {error ? (
          <MessageSlot id={id} variant={variant} tone="error">
            {error}
          </MessageSlot>
        ) : null}
      </>
    ),
  };
}
