import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useRef } from 'react';

import { cn } from '../../lib/cn';
import { useRovingFocus } from '../../hooks/useRovingFocus';

export type SegmentedControlOption = {
  label: string;
  value: string;
};

export type SegmentedControlProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'role'> & {
  options: SegmentedControlOption[];
  value: string;
  onValueChange: (value: string) => void;
};

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  function SegmentedControl({ className, options, value, onValueChange, ...props }, ref) {
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const activeIndex = options.findIndex((option) => option.value === value);
    const tabbableIndex = activeIndex === -1 ? 0 : activeIndex;

    const getItems = useCallback(
      () => itemRefs.current.filter((node): node is HTMLButtonElement => node !== null),
      [],
    );

    // Radio-group semantics: moving the highlight also selects, unlike tabs
    // where focus and selection are independent.
    const navigate = useRovingFocus({
      getItems,
      onNavigate: (index, item) => {
        const option = options[index];
        if (!option) {
          return;
        }
        onValueChange(option.value);
        item.focus();
      },
    });

    return (
      <div ref={ref} role="radiogroup" className={cn('ds-segmented-control', className)} {...props}>
        {options.map((option, index) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={index === tabbableIndex ? 0 : -1}
              className={cn(
                'ds-segmented-control__item',
                isActive && 'ds-segmented-control__item--active',
              )}
              onClick={() => onValueChange(option.value)}
              onKeyDown={navigate}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  },
);
