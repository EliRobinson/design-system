import type { HTMLAttributes, InputHTMLAttributes } from 'react';
import { createContext, forwardRef, useContext, useId, useState } from 'react';

import { cn } from '../../lib/cn.js';

type RadioGroupContextValue = {
  name: string;
  value: string | undefined;
  setValue: (value: string) => void;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error('RadioGroupItem must be used within RadioGroup');
  }
  return context;
}

export type RadioGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'role'> & {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  { className, name, value, defaultValue, onValueChange, children, ...props },
  ref,
) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;

  const setValue = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <RadioGroupContext.Provider value={{ name, value: currentValue, setValue }}>
      <div ref={ref} role="radiogroup" className={cn('ds-radio-group', className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
});

export type RadioGroupItemProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'name' | 'checked' | 'onChange'
> & {
  value: string;
  label: string;
};

export const RadioGroupItem = forwardRef<HTMLInputElement, RadioGroupItemProps>(
  function RadioGroupItem({ className, value, label, id, ...props }, ref) {
    const { name, value: groupValue, setValue } = useRadioGroupContext();
    const generatedId = useId();
    const itemId = id ?? generatedId;

    /* Labelled row, for the reason spelled out in Checkbox — and here the row
       is load-bearing twice over: the option text can be short ("Ash" measured
       28x23), so even a full-height text label would not have reached 44px
       wide. The row, input and gap included, does. */
    return (
      <label className="ds-radio-group__item" htmlFor={itemId}>
        <input
          ref={ref}
          type="radio"
          id={itemId}
          name={name}
          value={value}
          checked={groupValue === value}
          onChange={() => setValue(value)}
          className={cn('ds-radio-group__input', className)}
          {...props}
        />
        <span className="ds-radio-group__label">{label}</span>
      </label>
    );
  },
);
