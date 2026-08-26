import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';

/* Filled and empty stars are different SHAPES, not one shape in two colours.
   Both states used ★ and were told apart by colour alone, which is SC 1.4.1
   (Use of Color) — and it put the two states 2.66:1 apart, under the 3:1
   SC 1.4.11 asks between adjacent meaningful graphics. Shape carries the
   value now, so the colour difference is reinforcement rather than the
   only channel.

   The characters became drawn marks in #166, and solid-versus-outline is the
   same distinction ★ and ☆ carried — see `filled` in lib/marks.tsx. The star
   keeps its stroke when filled, so a row does not change width as it fills. */

export type RatingProps = Omit<HTMLAttributes<HTMLDivElement>, 'role'> & {
  value: number;
  max?: number;
  onValueChange?: (value: number) => void;
};

export const Rating = forwardRef<HTMLDivElement, RatingProps>(function Rating(
  { className, value, max = 5, onValueChange, ...props },
  ref,
) {
  const stars = Array.from({ length: max }, (_, index) => index + 1);
  const isInteractive = Boolean(onValueChange);
  const clampedValue = Math.min(Math.max(value, 0), max);

  if (!isInteractive) {
    return (
      <div
        ref={ref}
        role="img"
        aria-label={`${clampedValue} out of ${max} stars`}
        className={cn('ds-rating', className)}
        {...props}
      >
        {stars.map((star) => (
          <span
            key={star}
            aria-hidden="true"
            className={cn('ds-rating__star', star <= clampedValue && 'ds-rating__star--filled')}
          >
            <Mark name="star" filled={star <= clampedValue} />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('ds-rating', className)} {...props}>
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Rate ${star} out of ${max} stars`}
          aria-pressed={star <= clampedValue}
          className={cn('ds-rating__button', star <= clampedValue && 'ds-rating__star--filled')}
          onClick={() => onValueChange?.(star)}
        >
          <Mark name="star" filled={star <= clampedValue} />
        </button>
      ))}
    </div>
  );
});
