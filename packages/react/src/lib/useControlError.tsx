import type { ReactNode } from 'react';
import { useId } from 'react';

export type ControlErrorProps = {
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

const VARIANTS = {
  /** `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`. */
  field: { Tag: 'span', hint: 'ds-hint', error: 'ds-hint ds-hint--error' },
  /** `FormField`. */
  'form-field': {
    Tag: 'p',
    hint: 'ds-form-field__message ds-form-field__message--hint',
    error: 'ds-form-field__message ds-form-field__message--error',
  },
} as const;

/**
 * The hint and error of every labelled control: the message slots and the
 * control's `aria-invalid` and `aria-describedby`. Internal: not exported from
 * the package.
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
export function useControlError(
  error: string | undefined,
  ariaDescribedBy: string | undefined,
  { hint, variant = 'field' }: { hint?: string; variant?: keyof typeof VARIANTS } = {},
): { controlProps: ControlErrorProps; message: ReactNode } {
  const id = useId();
  const { Tag, ...className } = VARIANTS[variant];

  return {
    controlProps: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby':
        [ariaDescribedBy, error || hint ? id : null].filter(Boolean).join(' ') || undefined,
    },
    message: (
      <>
        {hint && !error ? (
          <Tag id={id} className={className.hint}>
            {hint}
          </Tag>
        ) : null}
        {error ? (
          <Tag id={id} className={className.error} role="alert">
            {error}
          </Tag>
        ) : null}
      </>
    ),
  };
}
