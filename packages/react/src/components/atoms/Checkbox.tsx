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

  return (
    <div className="ds-checkbox">
      <input
        ref={ref}
        type="checkbox"
        id={checkboxId}
        className={cn('ds-checkbox__input', className)}
        {...props}
      />
      <label htmlFor={checkboxId} className="ds-checkbox__label">
        {label}
      </label>
    </div>
  );
});
