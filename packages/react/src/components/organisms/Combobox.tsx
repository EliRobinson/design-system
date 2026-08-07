import type { KeyboardEvent } from 'react';
import { forwardRef, useEffect, useId, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { useClickOutside } from '../../hooks/useClickOutside';
import { SearchField } from '../molecules/SearchField';
import { VirtualList } from './VirtualList';

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

// Fixed row height for every option row -- required by VirtualList's
// `estimateSize` (it needs a size even for fixed-height rows) and also used
// by our own scroll-into-view math below, since VirtualList exposes no
// scrollToIndex/virtualizer handle for us to delegate to. 44px matches the
// A2/A11 touch-target rule: Combobox options are primary, button-like
// listbox controls (not the dense-inline-affordance exception carved out
// for Chip/SearchField-clear/Rating/DatePicker-day), so the 44px floor
// still applies here.
const OPTION_HEIGHT = 44;
const LIST_MAX_HEIGHT = 240;

// ComboboxProps is a closed set, mirroring DatePicker's pattern: no
// HTML-attribute passthrough and no trailing `{...props}` spread anywhere
// below. That means there is no open surface for a consumer -- typed or
// not, `as any` or plain JS -- to clobber the internally computed
// `role="combobox"`/`"listbox"`/`"option"`, the generated ids, or the
// aria-* wiring (`aria-expanded`, `aria-controls`, `aria-activedescendant`,
// `aria-selected`) this component owns (A7/A12). Every attribute placed on
// the input, the listbox, and each option is computed here, not accepted
// from outside.
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  { label, options, value, onValueChange, className },
  ref,
) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndexState, setActiveIndexState] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Third argument gates the document-level `mousedown` listener to only be
  // attached while the popover is open -- see DatePicker.tsx / Popover.tsx.
  // Omitting it leaves the listener registered for the component's entire
  // lifetime, even while closed.
  useClickOutside([containerRef], () => close(), isOpen);

  const selectedLabel = options.find((option) => option.value === value)?.label ?? '';
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );

  // `activeIndexState` can go stale relative to `filtered` (e.g. the user
  // narrowed the query below the previously active index), so it's clamped
  // to the current filtered range on every render rather than trusted
  // as-is -- a union-of-valid-indices problem, same category as A13's
  // "a type is not a runtime guard" but for array bounds instead of a
  // fixed-value union.
  const activeIndex = filtered.length === 0 ? -1 : Math.min(activeIndexState, filtered.length - 1);
  const activeOption = activeIndex >= 0 ? filtered[activeIndex] : undefined;
  const activeOptionId = activeOption ? `${baseId}-option-${activeIndex}` : undefined;

  function open() {
    if (!isOpen) {
      setIsOpen(true);
      setActiveIndexState(0);
    }
  }

  function close() {
    setIsOpen(false);
    setQuery('');
  }

  function selectOption(index: number) {
    const option = filtered[index];
    if (!option) {
      return;
    }
    onValueChange(option.value);
    close();
  }

  // VirtualList only exposes the scrollable DOM node via its forwarded ref,
  // not the underlying virtualizer instance (no `scrollToIndex`), so this
  // reimplements "scroll the row at `index` into view" from the outside.
  // It has to work even when the target row has been virtualized out of the
  // rendered window entirely (that's the whole point) -- `scrollIntoView`
  // on the row element wouldn't, since the element may not exist yet.
  //
  // This can't be a single computed jump. react-virtual only knows the real
  // size of a row once it has actually been rendered and measured
  // (`measureElement`); every not-yet-rendered row is still using
  // `estimateSize`'s guess. So "how far to scroll to reach index N" is a
  // moving target that depends on how many rows in between have been
  // measured, which we can't compute from outside without the virtualizer
  // instance. Instead this nudges toward the target using the nearest
  // rendered row's *actual* measured height, re-samples the DOM after each
  // nudge (since it may have just measured more rows), and repeats until
  // the target row shows up or a bounded number of attempts is exhausted.
  // Each nudge is deferred to its own macrotask rather than done inline:
  // react-virtual's scroll listener re-renders via `flushSync`, which
  // conflicts ("flushSync was called from inside a lifecycle method") if
  // fired synchronously from this same effect's commit; deferring it lets
  // that commit finish first. A no-op timing-wise in a real browser, where
  // the native scroll event already arrives on its own task anyway.
  useEffect(() => {
    const container = listRef.current;
    if (!container || activeIndex < 0 || filtered.length === 0) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    let timeoutId: ReturnType<typeof setTimeout>;

    function step() {
      if (cancelled || attempts >= MAX_ATTEMPTS || !container) {
        return;
      }
      attempts += 1;

      if (container.querySelector(`[data-index="${activeIndex}"]`)) {
        return; // Already rendered -- nothing left to do.
      }

      const rows = Array.from(container.querySelectorAll('[data-index]')) as HTMLElement[];
      if (rows.length === 0) {
        return;
      }
      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];
      const firstIndex = Number(firstRow.dataset.index);
      const lastIndex = Number(lastRow.dataset.index);

      let boundaryRow: HTMLElement;
      let indexGap: number;
      if (activeIndex < firstIndex) {
        boundaryRow = firstRow;
        indexGap = firstIndex - activeIndex;
      } else if (activeIndex > lastIndex) {
        boundaryRow = lastRow;
        indexGap = activeIndex - lastIndex;
      } else {
        return; // Within the measured range but not individually found -- stop rather than loop.
      }
      const rowHeight = parseFloat(boundaryRow.style.height || '') || OPTION_HEIGHT;

      container.scrollTop =
        activeIndex < firstIndex
          ? Math.max(0, container.scrollTop - rowHeight * indexGap)
          : container.scrollTop + rowHeight * indexGap;
      container.dispatchEvent(new Event('scroll'));

      timeoutId = setTimeout(step, 0);
    }

    timeoutId = setTimeout(step, 0);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeIndex, filtered.length]);

  function moveActive(delta: number) {
    if (filtered.length === 0) {
      return;
    }
    setActiveIndexState((current) => {
      const clampedCurrent = Math.min(current, filtered.length - 1);
      return Math.max(0, Math.min(filtered.length - 1, clampedCurrent + delta));
    });
  }

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
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        value={isOpen ? query : selectedLabel}
        onValueChange={(next) => {
          setQuery(next);
          setIsOpen(true);
          setActiveIndexState(0);
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
              const optionId = `${baseId}-option-${index}`;
              const isActive = index === activeIndex;
              const isSelected = option.value === value;
              // `aria-selected` tracks the *active* (keyboard-highlighted)
              // option, not the previously-chosen `value` -- this is the
              // WAI-ARIA combobox-with-listbox-popup convention: it marks
              // "the option that would be chosen if Enter were pressed
              // now," which is exactly what aria-activedescendant points
              // at. The previously-chosen value gets its own visual
              // treatment (`--selected`) instead, so the two concepts don't
              // collide on one ARIA attribute.
              return (
                <div
                  id={optionId}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={-1}
                  className={cn(
                    'ds-combobox__option',
                    isSelected && 'ds-combobox__option--selected',
                    isActive && 'ds-combobox__option--active',
                  )}
                  // Prevent the option row from ever stealing DOM focus away
                  // from the input on mousedown -- the WAI-ARIA combobox
                  // pattern keeps focus on the input at all times and drives
                  // highlighting purely through aria-activedescendant.
                  // `onClick` still fires normally afterward.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndexState(index)}
                  onClick={() => selectOption(index)}
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
