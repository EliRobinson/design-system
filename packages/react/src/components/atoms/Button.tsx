import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'ds-button',
        `ds-button--${variant}`,
        `ds-button--${size}`,
        disabled && 'ds-button--disabled',
        className,
      )}
      type={type}
      disabled={disabled}
      {...props}
    />
  );
});
