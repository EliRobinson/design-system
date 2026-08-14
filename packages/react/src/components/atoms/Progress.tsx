import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type ProgressProps = HTMLAttributes<HTMLDivElement> & {
  value: number;
  max?: number;
  label?: string;
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { className, value, max = 100, label, ...props },
  ref,
) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = (clamped / max) * 100;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('ds-progress', className)}
      {...props}
    >
      <div className="ds-progress__bar" style={{ width: `${percent}%` }} />
    </div>
  );
});
