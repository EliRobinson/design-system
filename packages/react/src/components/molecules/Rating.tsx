import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';

/* Filled and empty stars are different shapes, not one shape in two colours.
   Both states used ★ and were told apart by colour alone, which is SC 1.4.1
   (Use of Color) — and it put the two states 2.66:1 apart, under the 3:1
   SC 1.4.11 asks between adjacent meaningful graphics. Shape carries the
   value, so the colour difference is reinforcement rather than the only
   channel.

   The shapes are drawn now rather than typeset (#166). A solid star and an
   outlined one is the same distinction ★ and ☆ carried, with the difference
   that it no longer depends on a font having both glyphs and placing them
   alike — and the two states paint to the same box, which two characters did
   not guarantee. `filled` is the whole state; see lib/marks.tsx. */

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
