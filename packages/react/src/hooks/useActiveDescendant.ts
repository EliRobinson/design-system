import { useCallback, useState } from 'react';
import type { MouseEvent } from 'react';

export type ActiveDescendantOptions = {
  /** How many options are currently selectable (i.e. after filtering). */
  count: number;
  /** Id prefix for the generated option ids. Pass a `useId()` value. */
  baseId: string;
  /** Invoked when an option is clicked. */
  onSelect: (index: number) => void;
};

export type ActiveOptionProps = {
  id: string;
  role: 'option';
  'aria-selected': boolean;
  tabIndex: -1;
  onMouseDown: (event: MouseEvent) => void;
  onMouseEnter: () => void;
  onClick: () => void;
};

export type ActiveDescendant = {
  /** Clamped to the current `count`; `-1` when there are no options. */
  activeIndex: number;
  /** Id of the active option, for `aria-activedescendant`. */
  activeId: string | undefined;
  /** Highlights `index` outright (used when the option set is replaced). */
  setActiveIndex: (index: number) => void;
  /** Moves the highlight by `delta`, clamped at both ends (no wrapping). */
  moveActive: (delta: number) => void;
  /** Every attribute an option element needs. Spread onto the option. */
  getOptionProps: (index: number) => ActiveOptionProps;
};

/**
 * The `aria-activedescendant` half of the WAI-ARIA combobox/listbox pattern:
 * DOM focus stays on the input at all times and the "highlighted" option is
 * conveyed purely by id reference.
 *
 * Owns one invariant that is easy to get wrong in two different places, which
 * is why it lives here rather than in each widget: the highlighted index must
 * always be inside the current option range. Filtering shrinks that range out
 * from under a previously-valid index, and an unclamped index hands
 * `aria-activedescendant` a dangling id — visually fine, silently broken for
 * assistive tech.
 *
 * Note that the clamp is applied twice, deliberately. The *derived*
 * `activeIndex` is clamped so the rendered output is always valid, and
 * `moveActive` clamps the stored value again *before* applying its delta. Only
 * clamping the derived value leaves the raw state parked above the valid range,
 * where a single arrow key moves it from (say) 5 to 4 — both of which still
 * clamp to 1, so the highlight appears stuck until the user presses the key
 * enough times to walk back into range.
 */
export function useActiveDescendant({
  count,
  baseId,
  onSelect,
}: ActiveDescendantOptions): ActiveDescendant {
  const [storedIndex, setStoredIndex] = useState(0);

  const activeIndex = count === 0 ? -1 : Math.min(storedIndex, count - 1);
  const activeId = activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined;

  const moveActive = useCallback(
    (delta: number) => {
      setStoredIndex((current) => {
        if (count === 0) {
          return 0;
        }
        const clampedCurrent = Math.min(current, count - 1);
        return Math.max(0, Math.min(count - 1, clampedCurrent + delta));
      });
    },
    [count],
  );

  const getOptionProps = useCallback(
    (index: number): ActiveOptionProps => ({
      id: `${baseId}-option-${index}`,
      role: 'option',
      'aria-selected': index === activeIndex,
      tabIndex: -1,
      // Keep DOM focus on the input: without this the option steals focus on
      // mousedown, which breaks the activedescendant model outright. `onClick`
      // still fires normally afterward.
      onMouseDown: (event: MouseEvent) => event.preventDefault(),
      onMouseEnter: () => setStoredIndex(index),
      onClick: () => onSelect(index),
    }),
    [baseId, activeIndex, onSelect],
  );

  return {
    activeIndex,
    activeId,
    setActiveIndex: setStoredIndex,
    moveActive,
    getOptionProps,
  };
}
