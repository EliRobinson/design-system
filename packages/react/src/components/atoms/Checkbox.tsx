import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  /* The row is the label, not a div wrapping one. The input is 18x18 and the
     text beside it was 23px tall, so the only thing a finger could aim at was
     the box itself — the 44px row around it forwarded nothing, because a div
     is not an activator. Labelling the whole row makes the 44px it already
     occupies the actual hit area. Same markup box, same painted pixels. */
  return (
    <label className="ds-checkbox" htmlFor={checkboxId}>
      <input
        ref={ref}
        type="checkbox"
        id={checkboxId}
        className={cn('ds-checkbox__input', className)}
        {...props}
      />
      <span className="ds-checkbox__label">{label}</span>
    </label>
  );
});
