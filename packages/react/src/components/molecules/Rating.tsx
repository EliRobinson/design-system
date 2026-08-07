import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

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

  if (!isInteractive) {
    return (
      <div
        ref={ref}
        role="img"
        aria-label={`${value} out of ${max} stars`}
        className={cn('ds-rating', className)}
        {...props}
      >
        {stars.map((star) => (
          <span
            key={star}
            aria-hidden="true"
            className={cn('ds-rating__star', star <= value && 'ds-rating__star--filled')}
          >
            ★
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
          className={cn('ds-rating__button', star <= value && 'ds-rating__star--filled')}
          onClick={() => onValueChange?.(star)}
        >
          <span aria-hidden="true">★</span>
        </button>
      ))}
    </div>
  );
});
