import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';
import { useControlError } from '../../lib/useControlError.js';

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & {
  label: string;
  /**
   * Marks the control invalid and renders the message with `role="alert"`, the
   * way `Input`'s `error` does. The message is a sibling after the row, so in a
   * flex or grid parent it is laid out as its own item.
   */
  error?: string;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, id, label, error, 'aria-describedby': ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const { controlProps, message } = useControlError(error, ariaDescribedBy);

  /* Labelled row, for the reason spelled out in Checkbox: the track is 44x24,
     so it fails the 44px contract on height, and the text beside it carried no
     hit area of its own. */
  return (
    <>
      <label className={cn('ds-switch', error && 'ds-switch--error')} htmlFor={switchId}>
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          id={switchId}
          className={cn('ds-switch__input', className)}
          {...controlProps}
          {...props}
        />
        <span className="ds-switch__label">{label}</span>
      </label>
      {/* A sibling, not a wrapper: see useControlError. */}
      {message}
    </>
  );
});
