import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const mergedClassName = `ds-input ${className}`.trim();

  return (
    <div className="ds-field">
      <label htmlFor={inputId} className="ds-label">
        {label}
      </label>
      <input ref={ref} id={inputId} className={mergedClassName} {...props} />
    </div>
  );
});
