import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from './cn.js';

export type FieldMessageControlProps = {
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

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

type Variant = keyof typeof VARIANTS;

export type FieldMessageOptions = {
  error?: string;
  hint?: string;
  /** The caller's own `aria-describedby`. It comes first. */
  ariaDescribedBy?: string;
  variant?: Variant;
};

type MessageSlotProps = HTMLAttributes<HTMLElement> & {
  variant: Variant;
  tone: 'hint' | 'error';
};

/**
 * One message element: a hint, or an error with `role="alert"`. The hook below
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

/**
 * The hint and error of every labelled control: the message slots and the
 * control's `aria-invalid` and `aria-describedby`. Internal: not exported from
 * the package. `FieldError` is the public face of its error slot.
 *
 * At most one message shows, so both slots share one id, and the control is
 * described by it only while one is rendered: no id points at a missing node.
 * The caller's own `aria-describedby` comes first.
 *
 * Two slots, not one ternary: a hint turning into an error must mount a fresh
 * `role="alert"` element. Reusing the hint's node would add the role and the
 * text in one commit, and a live region that did not exist before the change
 * is not reliably announced.
 *
 * Render `message` as a sibling after the control (for `Checkbox` and `Switch`,
 * after the `<label>` row, so the message stays out of the accessible name). It
 * is not a wrapper: wrapping only when there is an error would remount the input
 * when one appears and drop an uncontrolled value. Without a hint or an error it
 * renders nothing, so the control renders the markup it always did.
 */
export function useFieldMessage({
  error,
  hint,
  ariaDescribedBy,
  variant = 'field',
}: FieldMessageOptions = {}): { controlProps: FieldMessageControlProps; message: ReactNode } {
  const id = useId();

  return {
    controlProps: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby':
        [ariaDescribedBy, error || hint ? id : null].filter(Boolean).join(' ') || undefined,
    },
    message: (
      <>
        {hint && !error ? (
          <MessageSlot id={id} variant={variant} tone="hint">
            {hint}
          </MessageSlot>
        ) : null}
        {error ? (
          <MessageSlot id={id} variant={variant} tone="error">
            {error}
          </MessageSlot>
        ) : null}
      </>
    ),
  };
}
