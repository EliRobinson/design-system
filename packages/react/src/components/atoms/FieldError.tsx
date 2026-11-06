import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { MessageSlot } from '../../lib/useFieldMessage.js';

/* Written out, not taken from `lib/`: the Design System artifact build inlines
   each component's public types and has no rule for a `lib/` import. */
export type FieldErrorProps = Omit<HTMLAttributes<HTMLSpanElement>, 'role'> & {
  /** For a control or group's `aria-describedby`. */
  id?: string;
};

/**
 * The error message of a field with no control of its own, such as a list or a
 * group. It is the same element `Input`'s `error` renders: a
 * `<span class="ds-hint ds-hint--error" role="alert">`. With no children it
 * renders nothing, so render it always and pass the error or nothing.
 *
 * A control with an `error` prop renders this itself. Use `FieldError` only
 * where there is no such control to pass the error to.
 */
export const FieldError = forwardRef<HTMLSpanElement, FieldErrorProps>(function FieldError(
  { children, ...props },
  ref,
) {
  if (children == null || children === false || children === '') return null;
  return (
    <MessageSlot ref={ref} variant="field" tone="error" {...props}>
      {children}
    </MessageSlot>
  );
});
