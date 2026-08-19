import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type ScopeProbeVariant = 'default' | 'signal' | 'anchor' | 'solid' | 'outline';

export type ScopeProbeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: ScopeProbeVariant;
};

export const ScopeProbe = forwardRef<HTMLSpanElement, ScopeProbeProps>(function ScopeProbe(
  { className, variant = 'default', ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn('ds-scopeprobe', `ds-scopeprobe--${variant}`, className)}
      {...props}
    />
  );
});
