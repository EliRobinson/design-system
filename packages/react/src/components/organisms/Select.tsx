import type { SelectHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';
import { useFieldMessage } from '../../lib/useFieldMessage.js';

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
  const selectId = id ?? generatedId;
  const { controlProps, message } = useFieldMessage({ error, hint, ariaDescribedBy });

  return (
    <div className="ds-field">
      <label htmlFor={selectId} className="ds-label">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        className={cn('ds-input', 'ds-select', error && 'ds-input--error', className)}
        {...controlProps}
        {...props}
      >
        {children}
      </select>
      {message}
    </div>
  );
});
