import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../lib/cn';

export type SeparatorProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical';
};

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  { className, orientation = 'horizontal', role = 'separator', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role={role}
      aria-orientation={orientation}
      className={cn('ds-separator', `ds-separator--${orientation}`, className)}
      {...props}
    />
  );
});
