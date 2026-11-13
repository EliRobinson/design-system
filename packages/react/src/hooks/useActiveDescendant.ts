import { useCallback, useState } from 'react';
import type { MouseEvent } from 'react';

import { useLatest } from '../lib/useLatest.js';

export type ActiveDescendantOptions = {
  /** How many options are currently selectable (i.e. after filtering). */
  count: number;
  /** Id prefix for the generated option ids. Pass a `useId()` value. */
  baseId: string;
  /** Invoked when an option is clicked. */
  onSelect: (index: number) => void;
  /**
   * A stable key per option, in option order (so `keys.length === count`).
   * Give it when the option set can change under the user, such as async
   * results: the highlight then follows the option's key, not its position,
   * and falls back to the first option only when that key is gone. Omit it
   * and the highlight is held by position.
   */
  keys?: readonly string[];
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
  /** Highlights `index` outright. With `keys`, the highlight then follows
   * that option's key. */
  setActiveIndex: (index: number) => void;
  /** Highlights the first option and follows no key, so when the options
   * change the highlight stays on top. Same as `setActiveIndex(0)` without
   * `keys`. Use it when the user starts a new search. */
  resetActive: () => void;
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
type Stored = { index: number; key: string | undefined };

/**
 * Where the stored highlight sits in the current options. A stored key that
 * is still present wins over the stored index; a stored key that is gone falls
 * back to the first option. With no key, the index is clamped into range.
 */
function resolveIndex(stored: Stored, count: number, keys: readonly string[] | undefined): number {
  if (count === 0) {
    return -1;
  }
  if (keys && stored.key !== undefined) {
    const found = keys.indexOf(stored.key);
    return found >= 0 && found < count ? found : 0;
  }
  return Math.min(stored.index, count - 1);
}

export function useActiveDescendant({
  count,
  baseId,
  onSelect,
  keys,
}: ActiveDescendantOptions): ActiveDescendant {
  const [stored, setStored] = useState<Stored>({ index: 0, key: undefined });
  // Read at event time, so a caller that rebuilds `keys` every render does
  // not churn the callbacks below (CommandPalette's open effect depends on
  // `resetActive`).
  const keysRef = useLatest(keys);

  const activeIndex = resolveIndex(stored, count, keys);
  const activeId = activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined;

  const setActiveIndex = useCallback(
    (index: number) => setStored({ index, key: keysRef.current?.[index] }),
    [keysRef],
  );

  const resetActive = useCallback(() => setStored({ index: 0, key: undefined }), []);

  const moveActive = useCallback(
    (delta: number) => {
      setStored((current) => {
        if (count === 0) {
          return { index: 0, key: undefined };
        }
        const currentKeys = keysRef.current;
        const clampedCurrent = resolveIndex(current, count, currentKeys);
        const next = Math.max(0, Math.min(count - 1, clampedCurrent + delta));
        return { index: next, key: currentKeys?.[next] };
      });
    },
    [count, keysRef],
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
      onMouseEnter: () => setActiveIndex(index),
      onClick: () => onSelect(index),
    }),
    [baseId, activeIndex, onSelect, setActiveIndex],
  );

  return {
    activeIndex,
    activeId,
    setActiveIndex,
    resetActive,
    moveActive,
    getOptionProps,
  };
}
