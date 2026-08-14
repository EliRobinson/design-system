import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type EyebrowProps = HTMLAttributes<HTMLSpanElement>;

export const Eyebrow = forwardRef<HTMLSpanElement, EyebrowProps>(function Eyebrow(
  { className, ...props },
  ref,
) {
  return <span ref={ref} className={cn('ds-eyebrow', className)} {...props} />;
});
