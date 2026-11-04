import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';
import { useControlError } from '../../lib/useControlError.js';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, id, label, hint, error, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const { controlProps, message } = useControlError(error, ariaDescribedBy, hint);

  return (
    <div className="ds-field">
      <label htmlFor={inputId} className="ds-label">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cn('ds-input', error && 'ds-input--error', className)}
        {...controlProps}
        {...props}
      />
      {message}
    </div>
  );
});
