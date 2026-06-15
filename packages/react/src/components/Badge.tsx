import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../lib/cn';

export type BadgeVariant = 'default' | 'signal' | 'anchor' | 'solid' | 'outline';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant = 'default', ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn('ds-badge', `ds-badge--${variant}`, className)} {...props} />
  );
});
