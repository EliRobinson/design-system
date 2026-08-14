import type { InputHTMLAttributes } from 'react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { cn } from '../../lib/cn.js';

export type SearchFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value' | 'defaultValue'
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { className, value, defaultValue, onValueChange, ...props },
  ref,
) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);

  const setValue = (next: string) => {
    if (!isControlled) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <div className={cn('ds-search-field', className)}>
      <span className="ds-search-field__icon" aria-hidden="true">
        ⌕
      </span>
      <input
        ref={innerRef}
        type="search"
        value={currentValue}
        onChange={(event) => setValue(event.target.value)}
        className="ds-search-field__input"
        {...props}
      />
      {currentValue ? (
        <button
          type="button"
          className="ds-search-field__clear"
          aria-label="Clear search"
          onClick={() => {
            setValue('');
            innerRef.current?.focus();
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
});
