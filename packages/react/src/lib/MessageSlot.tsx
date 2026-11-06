import type { HTMLAttributes, Ref } from 'react';
import { forwardRef } from 'react';

import { cn } from './cn.js';

const VARIANTS = {
  /** `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, and the public `FieldError`. */
  field: { Tag: 'span', hint: 'ds-hint', error: 'ds-hint ds-hint--error' },
  /** `FormField`. */
  'form-field': {
    Tag: 'p',
    hint: 'ds-form-field__message ds-form-field__message--hint',
    error: 'ds-form-field__message ds-form-field__message--error',
  },
} as const;

export type MessageVariant = keyof typeof VARIANTS;

type MessageSlotProps = HTMLAttributes<HTMLElement> & {
  variant: MessageVariant;
  tone: 'hint' | 'error';
};

/**
 * One message element: a hint, or an error with `role="alert"`. `useFieldMessage`
 * renders it for every labelled control, and `FieldError` renders it on its own,
 * so a standalone error is the same element a control's error is.
 */
export const MessageSlot = forwardRef<HTMLElement, MessageSlotProps>(function MessageSlot(
  { variant, tone, className, ...props },
  ref,
) {
  const { Tag, ...classNames } = VARIANTS[variant];
  return (
    <Tag
      /* A span or a p. Both are HTMLElements, which is all the ref is typed as;
         TypeScript cannot pick the element type from a union tag. */
      ref={ref as Ref<HTMLSpanElement & HTMLParagraphElement>}
      {...props}
      className={cn(classNames[tone], className)}
      role={tone === 'error' ? 'alert' : undefined}
    />
  );
});
