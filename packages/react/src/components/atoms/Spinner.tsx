import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export type SpinnerProps = Omit<HTMLAttributes<HTMLSpanElement>, 'role'> & {
  size?: SpinnerSize;
  label?: string;
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { className, size = 'md', label = 'Loading', ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cn('ds-spinner', `ds-spinner--${size}`, className)}
      {...props}
    />
  );
});
