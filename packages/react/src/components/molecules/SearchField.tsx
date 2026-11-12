import type { InputHTMLAttributes } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';

import { useControllableState } from '../../hooks/useControllableState.js';
import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';

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
  const [currentValue, setValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? '',
    onChange: onValueChange,
  });

  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);

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
          <Mark name="cross" />
        </button>
      ) : null}
    </div>
  );
});
