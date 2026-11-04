import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';
import { FieldMessage, messageDescribedBy } from '../../lib/FieldMessage.js';
import { Label } from '../atoms/Label.js';

export type FormFieldRenderProps = {
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
};

export type FormFieldProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: string;
  htmlFor: string;
  /**
   * Rendered after the label, on the same row — a status badge, a small action button.
   * It is a sibling of the `<label>`, never inside it, so the control's accessible name
   * stays exactly `label` and a button here does not activate the control.
   */
  labelAside?: ReactNode;
  hint?: string;
  /** Rendered with `role="alert"`, as `Input`'s is, so it is announced when it appears. */
  error?: string;
  required?: boolean;
  children: (fieldProps: FormFieldRenderProps) => ReactNode;
};

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(function FormField(
  { className, label, htmlFor, labelAside, hint, error, required, children, ...props },
  ref,
) {
  // One id: FieldMessage shows at most one of the two messages at a time.
  const messageId = useId();

  const labelElement = (
    <Label htmlFor={htmlFor} className="ds-form-field__label">
      {label}
      {required ? (
        <span className="ds-form-field__required" aria-hidden="true">
          {' '}
          *
        </span>
      ) : null}
    </Label>
  );

  return (
    <div ref={ref} className={cn('ds-form-field', className)} {...props}>
      {labelAside ? (
        <div className="ds-form-field__label-row">
          {labelElement}
          {labelAside}
        </div>
      ) : (
        labelElement
      )}
      {children({
        'aria-describedby': messageDescribedBy(hint, error, messageId, messageId),
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      <FieldMessage
        as="p"
        hint={hint}
        error={error}
        hintId={messageId}
        errorId={messageId}
        hintClassName="ds-form-field__message ds-form-field__message--hint"
        errorClassName="ds-form-field__message ds-form-field__message--error"
      />
    </div>
  );
});
