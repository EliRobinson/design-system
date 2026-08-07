import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn';

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const sliderId = id ?? generatedId;

  return (
    <div className="ds-slider">
      <label htmlFor={sliderId} className="ds-slider__label">
        {label}
      </label>
      <input
        ref={ref}
        type="range"
        id={sliderId}
        className={cn('ds-slider__input', className)}
        {...props}
      />
    </div>
  );
});
