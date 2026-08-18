import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & {
  label: string;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const switchId = id ?? generatedId;

  /* Labelled row, for the reason spelled out in Checkbox: the track is 44x24,
     so it fails the 44px contract on height, and the text beside it carried no
     hit area of its own. */
  return (
    <label className="ds-switch" htmlFor={switchId}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        id={switchId}
        className={cn('ds-switch__input', className)}
        {...props}
      />
      <span className="ds-switch__label">{label}</span>
    </label>
  );
});
