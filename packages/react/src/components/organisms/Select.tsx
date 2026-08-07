import type { SelectHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, id, label, hint, error, children, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const hintId = useId();
  const errorId = useId();
  const selectId = id ?? generatedId;
  const describedBy =
    [ariaDescribedBy, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="ds-field">
      <label htmlFor={selectId} className="ds-label">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        className={cn('ds-input', 'ds-select', error && 'ds-input--error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {children}
      </select>
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
