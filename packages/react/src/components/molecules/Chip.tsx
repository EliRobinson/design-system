import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';

export type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  onRemove?: () => void;
  /**
   * Accessible name for the remove button. Defaults to `Remove ${children}`,
   * which only produces a correct label when `children` is a plain string.
   * Pass this explicitly when `children` is an element (e.g. `<b>Design</b>`).
   */
  removeLabel?: string;
};

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { className, onRemove, removeLabel, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn('ds-chip', className)} {...props}>
      <span className="ds-chip__label">{children}</span>
      {onRemove ? (
        <button
          type="button"
          className="ds-chip__remove"
          aria-label={removeLabel ?? `Remove ${children}`}
          onClick={onRemove}
        >
          <Mark name="cross" />
        </button>
      ) : null}
    </span>
  );
});
