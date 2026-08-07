import type { HTMLAttributes, KeyboardEvent } from 'react';
import { forwardRef, useRef } from 'react';

import { cn } from '../../lib/cn';

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

    const selectByIndex = (index: number) => {
      const option = options[index];
      if (!option) {
        return;
      }
      onValueChange(option.value);
      itemRefs.current[index]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          selectByIndex((index + 1) % options.length);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          selectByIndex((index - 1 + options.length) % options.length);
          break;
        case 'Home':
          event.preventDefault();
          selectByIndex(0);
          break;
        case 'End':
          event.preventDefault();
          selectByIndex(options.length - 1);
          break;
        default:
          break;
      }
    };

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
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  },
);
