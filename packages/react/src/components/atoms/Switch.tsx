import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn';

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & {
  label: string;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const switchId = id ?? generatedId;

  return (
    <div className="ds-switch">
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        id={switchId}
        className={cn('ds-switch__input', className)}
        {...props}
      />
      <label htmlFor={switchId} className="ds-switch__label">
        {label}
      </label>
    </div>
  );
});
