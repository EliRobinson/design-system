import type { TextareaHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';
import { useFieldMessage } from '../../lib/useFieldMessage.js';

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
  const textareaId = id ?? generatedId;
  const { controlProps, message } = useFieldMessage({ error, hint, ariaDescribedBy });

  return (
    <div className="ds-field">
      <label htmlFor={textareaId} className="ds-label">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        className={cn('ds-input', 'ds-textarea', error && 'ds-input--error', className)}
        {...controlProps}
        {...props}
      />
      {message}
    </div>
  );
});
