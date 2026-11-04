import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';
import { useControlError } from '../../lib/useControlError.js';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  /**
   * Marks the control invalid and renders the message with `role="alert"`, the
   * way `Input`'s `error` does. The message is a sibling after the row, so in a
   * flex or grid parent it is laid out as its own item.
   */
  error?: string;
  /**
   * Keeps the label for assistive tech and as the 44px hit area, and draws no
   * text. Use it where something else already names the control, such as a row
   * header in a table.
   */
  hideLabel?: boolean;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, id, label, hideLabel, error, 'aria-describedby': ariaDescribedBy, ...props },
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
        <span className={cn('ds-checkbox__label', hideLabel && 'ds-checkbox__label--hidden')}>
          {label}
        </span>
      </label>
      {/* A sibling, not a wrapper: see useControlError. */}
      {message}
    </>
  );
});
