import type { TextareaHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, id, label, hint, error, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const hintId = useId();
  const errorId = useId();
  const textareaId = id ?? generatedId;
  const describedBy =
    [ariaDescribedBy, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="ds-field">
      <label htmlFor={textareaId} className="ds-label">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        className={cn('ds-input', 'ds-textarea', error && 'ds-input--error', className)}
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
