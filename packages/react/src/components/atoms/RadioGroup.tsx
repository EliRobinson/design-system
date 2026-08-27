import type { HTMLAttributes, InputHTMLAttributes } from 'react';
import { createContext, forwardRef, useContext, useEffect, useId, useRef, useState } from 'react';

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
  /**
   * Shared `name` for every item's `input[type="radio"]`, which makes it the
   * field name the group submits under. The group participates in native form
   * submission with no extra wiring: inside a `<form>` its selection shows up
   * in `FormData` and in a server action's payload under this `name`. Nothing
   * hidden needs to be added to carry the value across.
   */
  name: string;
  /**
   * Selection, when the group is controlled. `null` means controlled with
   * nothing selected; `undefined` means uncontrolled, and hands the selection
   * back to `defaultValue` and the group's own state. The distinction matters:
   * clear a controlled group with `null`, never with `undefined`.
   */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  { className, name, value, defaultValue, onValueChange, children, ...props },
  ref,
) {
  const [internalValue, setInternalValue] = useState(defaultValue);

  /* `value ?? internalValue` read "controlled but empty" as "uncontrolled",
     so a controlled group could not express "nothing selected" and could not
     be cleared once clicked. Worse, at the first click of a controlled-empty
     group `value === undefined` still held, so internal state was written too
     and the stale copy won every time the parent cleared. Controlledness is a
     property of `value` being passed at all -- `null` for the empty case --
     never of what it currently holds. */
  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value ?? undefined) : internalValue;

  /* The mode flip above is silent, and `undefined` is exactly what a consumer
     holding `useState<string | undefined>` reaches for to clear a group -- the
     one spelling that does not clear it, and the one the type cannot reject.
     React warns for the same mistake on a native input; this group renders a
     real input but derives `checked` itself, so React never sees the switch
     and never warns. Warn here instead, in dev, once per instance. */
  const wasControlled = useRef(isControlled);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (wasControlled.current && !isControlled) {
      wasControlled.current = false;
      console.warn(
        `RadioGroup "${name}" changed from controlled to uncontrolled: \`value\` went from a string to \`undefined\`, so the group fell back to its own state and kept the old selection. To clear a controlled group, pass \`null\`; \`undefined\` means uncontrolled.`,
      );
      return;
    }
    wasControlled.current = isControlled;
  }, [isControlled, name]);

  const setValue = (next: string) => {
    if (!isControlled) {
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
