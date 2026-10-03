import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';
import { useControlError } from '../../lib/useControlError.js';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  /**
   * Marks the control invalid and renders the message under the row with
   * `role="alert"`, the way `Input`'s `error` does.
   */
  error?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, id, label, error, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const { controlProps, message } = useControlError(error, ariaDescribedBy);

  /* The row is the label, not a div wrapping one. The input is 18x18 and the
     text beside it was 23px tall, so the only thing a finger could aim at was
     the box itself — the 44px row around it forwarded nothing, because a div
     is not an activator. Labelling the whole row makes the 44px it already
     occupies the actual hit area. Same markup box, same painted pixels. */
  return (
    <>
      <label className={cn('ds-checkbox', error && 'ds-checkbox--error')} htmlFor={checkboxId}>
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={cn('ds-checkbox__input', className)}
          {...controlProps}
          {...props}
        />
        <span className="ds-checkbox__label">{label}</span>
      </label>
      {/* A sibling, not a wrapper: wrapping only when there is an error would
          remount the input when one appears and drop an uncontrolled check. */}
      {message}
    </>
  );
});
