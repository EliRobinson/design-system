import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn';
import { Label } from '../atoms/Label';

export type FormFieldProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (fieldProps: {
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
  }) => ReactNode;
};

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(function FormField(
  { className, label, htmlFor, hint, error, required, children, ...props },
  ref,
) {
  const generatedId = useId();
  const messageId = error || hint ? generatedId : undefined;

  return (
    <div ref={ref} className={cn('ds-form-field', className)} {...props}>
      <Label htmlFor={htmlFor} className="ds-form-field__label">
        {label}
        {required ? <span className="ds-form-field__required"> *</span> : null}
      </Label>
      {children({
        'aria-describedby': messageId,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <p id={messageId} className="ds-form-field__message ds-form-field__message--error">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="ds-form-field__message ds-form-field__message--hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
