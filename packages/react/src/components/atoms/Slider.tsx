import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';
import { useFieldMessage } from '../../lib/useFieldMessage.js';

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  /**
   * Marks the slider invalid and renders the message with `role="alert"`, the
   * way `Input`'s `error` does.
   */
  error?: string;
};

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, id, label, error, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const sliderId = id ?? generatedId;
  const { controlProps, message } = useFieldMessage({ error, ariaDescribedBy });

  return (
    <div className="ds-slider">
      <label htmlFor={sliderId} className="ds-slider__label">
        {label}
      </label>
      <input
        ref={ref}
        type="range"
        id={sliderId}
        className={cn('ds-slider__input', error && 'ds-slider__input--error', className)}
        {...controlProps}
        {...props}
      />
      {message}
    </div>
  );
});
