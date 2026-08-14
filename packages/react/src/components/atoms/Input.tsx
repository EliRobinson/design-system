import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';

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
  const hintId = useId();
  const errorId = useId();
  const inputId = id ?? generatedId;
  const describedBy =
    [ariaDescribedBy, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="ds-field">
      <label htmlFor={inputId} className="ds-label">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cn('ds-input', error && 'ds-input--error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && !error && (
        <span id={hintId} className="ds-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="ds-hint ds-hint--error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
