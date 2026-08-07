import type { KeyboardEvent } from 'react';
import { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { useActiveDescendant } from '../../hooks/useActiveDescendant';
import { useClickOutside } from '../../hooks/useClickOutside';
import { SearchField } from '../molecules/SearchField';
import { VirtualList } from './VirtualList';
import type { VirtualListHandle } from './VirtualList';

export type ComboboxOption = {
  label: string;
  value: string;
};

export type ComboboxProps = {
  /** Accessible label for the combobox input (also its accessible name). */
  label: string;
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  className?: string;
};

// Fixed row height for every option row, required by VirtualList's
// `estimateSize`. 44px is the touch-target floor for primary controls, which
// listbox options are (unlike the dense inline affordances -- chip remove,
// search clear, rating star, calendar day -- that are sized to shadcn/MUI
// scale instead).
const OPTION_HEIGHT = 44;
const LIST_MAX_HEIGHT = 240;

// ComboboxProps is a closed set: no HTML-attribute passthrough and no
// trailing `{...props}` spread anywhere below, so a consumer cannot clobber
// the internally computed roles, generated ids, or aria-* wiring this
// component owns.
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  { label, options, value, onValueChange, className },
  ref,
) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VirtualListHandle>(null);

  // Third argument gates the document-level `mousedown` listener to only be
  // attached while the popover is open -- see DatePicker.tsx / Popover.tsx.
  // Omitting it leaves the listener registered for the component's entire
  // lifetime, even while closed.
  useClickOutside([containerRef], () => close(), isOpen);

  const selectedLabel = options.find((option) => option.value === value)?.label ?? '';
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );

  const selectOption = useCallback(
    (index: number) => {
      const option = filtered[index];
      if (!option) {
        return;
      }
      onValueChange(option.value);
      close();
    },
    [filtered, onValueChange],
  );

  const { activeIndex, activeId, setActiveIndex, moveActive, getOptionProps } = useActiveDescendant(
    { count: filtered.length, baseId, onSelect: selectOption },
  );

  function open() {
    if (!isOpen) {
      setIsOpen(true);
      setActiveIndex(0);
    }
  }

  function close() {
    setIsOpen(false);
    setQuery('');
  }

  // Keep the keyboard-highlighted option inside the rendered window. Only the
  // virtualizer can do this: a row that is currently windowed out has no DOM
  // node, so there is nothing to call `scrollIntoView` on, and the distance to
  // it depends on which intervening rows have been measured. `align: 'auto'`
  // leaves an already-visible row alone and scrolls the minimum distance
  // otherwise.
  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    listRef.current?.scrollToIndex(activeIndex, { align: 'auto' });
  }, [activeIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          open();
        } else {
          moveActive(1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) {
          open();
        } else {
          moveActive(-1);
        }
        break;
      case 'Enter':
        if (isOpen) {
          event.preventDefault();
          selectOption(activeIndex);
        }
        break;
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          close();
        }
        break;
      default:
        break;
    }
  }

  // Fixed pixel height is VirtualList's contract (no "auto up to a max"
  // mode), so a short filtered list gets a height sized to its own content
  // instead of always reserving the full 240px -- avoiding a dropdown that
  // shows 2 options plus a slab of empty space.
  const listHeight = Math.min(LIST_MAX_HEIGHT, Math.max(filtered.length, 1) * OPTION_HEIGHT);

  return (
    <div ref={containerRef} className={cn('ds-combobox', className)}>
      <SearchField
        ref={ref}
        aria-label={label}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        value={isOpen ? query : selectedLabel}
        onValueChange={(next) => {
          setQuery(next);
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onFocus={open}
        onKeyDown={handleKeyDown}
      />
      {isOpen ? (
        filtered.length === 0 ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label={`${label} options`}
            className="ds-combobox__list"
          >
            <p className="ds-combobox__empty">No matches</p>
          </div>
        ) : (
          <VirtualList
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={`${label} options`}
            items={filtered}
            estimateSize={() => OPTION_HEIGHT}
            height={listHeight}
            className="ds-combobox__list"
            renderItem={(option, index) => {
              const isActive = index === activeIndex;
              // `aria-selected` (supplied by getOptionProps) tracks the
              // *active* keyboard-highlighted option, not the previously
              // chosen `value` -- the WAI-ARIA convention is that it marks
              // "the option that would be chosen if Enter were pressed now",
              // which is exactly what aria-activedescendant points at. The
              // chosen value gets its own visual treatment (`--selected`)
              // instead, so the two concepts don't collide on one attribute.
              return (
                <div
                  {...getOptionProps(index)}
                  className={cn(
                    'ds-combobox__option',
                    option.value === value && 'ds-combobox__option--selected',
                    isActive && 'ds-combobox__option--active',
                  )}
                >
                  {option.label}
                </div>
              );
            }}
          />
        )
      ) : null}
    </div>
  );
});
