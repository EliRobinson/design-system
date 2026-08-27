import { forwardRef, useEffect, useRef, useState } from 'react';

import { useClickOutside } from '../../hooks/useClickOutside.js';
import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';

export type DatePickerProps = {
  /** Accessible label for the trigger input (also its accessible name). */
  label: string;
  value?: Date;
  onValueChange: (date: Date) => void;
  /**
   * Renders with the calendar already open. Uncontrolled, like the same prop
   * on Popover, DropdownMenu, Dialog and Sheet: it seeds the initial state and
   * then stops mattering, so the picker still opens and closes on its own.
   * There is no controlled `open` counterpart — after the first render the
   * picker owns its own open state.
   */
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Day 0 of `month + 1` is the last day of `month` -- the standard
 * local-date trick for "how many days in this month". It correctly rolls
 * December (month 11) into "day 0 of month 12", which `Date` normalizes
 * into January 0 of the next year (i.e. Dec 31), and it correctly returns
 * 29 for February in a leap year because leap-year math is `Date`'s job,
 * not ours -- we never hardcode 28/29/30/31 anywhere.
 */
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatValue(date: Date | undefined) {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isSameDay(a: Date | undefined, year: number, month: number, day: number) {
  return !!a && a.getFullYear() === year && a.getMonth() === month && a.getDate() === day;
}

/**
 * Builds full weeks (always 7 cells) for a given local year/month. Leading
 * cells before the 1st (padding out to the first weekday) and trailing
 * cells after the last day (rounding out the final week) are `null`
 * placeholders, rendered as empty `role="gridcell"` elements so every
 * `role="row"` has exactly 7 gridcell children -- required for a valid
 * ARIA grid, and independent of how many days the month actually has.
 *
 * All arithmetic here uses local-date constructors (`new Date(year, month,
 * day)`) and local getters (`getFullYear`/`getMonth`/`getDay`), never
 * `toISOString()` or any UTC-based accessor, so there is no timezone drift
 * from the calendar the user is actually looking at.
 */
function buildWeeks(year: number, month: number): (number | null)[][] {
  const totalDays = daysInMonth(year, month);
  const firstWeekday = new Date(year, month, 1).getDay();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// DatePickerProps is a closed set (label/value/onValueChange/defaultOpen/
// className) with no HTML-attribute passthrough and therefore no trailing
// `{...props}` spread anywhere below -- every attribute placed on the input
// and on the grid/row/gridcell/day elements is computed internally, so there
// is no open surface for a consumer to silently clobber a computed prop with
// a later spread.
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  { label, value, onValueChange, defaultOpen = false, className },
  ref,
) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [viewDate, setViewDate] = useState(() => value ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Track the last `value` timestamp we synced the displayed month from, so
  // we can tell "the value prop changed" apart from "the user navigated the
  // calendar" -- the latter must NOT be clobbered by a re-render where
  // `value` hasn't actually changed. Only a genuine change to `value`
  // (different time, or defined -> undefined and back) re-syncs `viewDate`.
  const lastSyncedValueRef = useRef<number | undefined>(value?.getTime());
  useEffect(() => {
    const valueTime = value?.getTime();
    if (valueTime !== lastSyncedValueRef.current) {
      lastSyncedValueRef.current = valueTime;
      if (value) {
        setViewDate(value);
      }
    }
  }, [value]);

  // Third argument gates the document-level `mousedown` listener to only be
  // attached while the popover is open. Omitting it leaves the listener
  // registered for the component's entire lifetime, even while closed.
  useClickOutside([containerRef], () => setIsOpen(false), isOpen);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weeks = buildWeeks(year, month);
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <div ref={containerRef} className={cn('ds-date-picker', className)}>
      <input
        ref={ref}
        type="text"
        className="ds-input"
        aria-label={label}
        readOnly
        value={formatValue(value)}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen ? (
        <div className="ds-date-picker__popover">
          <div className="ds-date-picker__header">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
            >
              <Mark name="chevron-left" />
            </button>
            <span>{monthLabel}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
            >
              <Mark name="chevron-right" />
            </button>
          </div>
          <div role="grid" aria-label={monthLabel} className="ds-date-picker__grid">
            {weeks.map((week, weekIndex) => (
              <div role="row" key={weekIndex} className="ds-date-picker__row">
                {week.map((day, dayIndex) =>
                  day === null ? (
                    // aria-disabled (not aria-hidden) keeps the cell present
                    // in the accessibility tree so every row still exposes
                    // exactly 7 gridcell children, as the ARIA grid pattern
                    // requires -- aria-hidden would instead prune it from
                    // the tree entirely, leaving the row structurally short.
                    <div
                      role="gridcell"
                      aria-disabled="true"
                      key={`blank-${weekIndex}-${dayIndex}`}
                      className="ds-date-picker__cell ds-date-picker__cell--empty"
                    />
                  ) : (
                    <div
                      role="gridcell"
                      key={day}
                      aria-selected={isSameDay(value, year, month, day)}
                      className="ds-date-picker__cell"
                    >
                      <button
                        type="button"
                        className={cn(
                          'ds-date-picker__day',
                          isSameDay(value, year, month, day) && 'ds-date-picker__day--selected',
                          isSameDay(today, year, month, day) && 'ds-date-picker__day--today',
                        )}
                        aria-current={isSameDay(today, year, month, day) ? 'date' : undefined}
                        onClick={() => {
                          onValueChange(new Date(year, month, day));
                          setIsOpen(false);
                        }}
                      >
                        {day}
                      </button>
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
});
