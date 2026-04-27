import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = '', variant = 'primary', type = 'button', ...props },
  ref,
) {
  const mergedClassName = `ds-button ds-button--${variant} ${className}`.trim();

  return <button ref={ref} className={mergedClassName} type={type} {...props} />;
});
