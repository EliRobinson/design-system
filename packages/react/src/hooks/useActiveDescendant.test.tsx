import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useActiveDescendant } from './useActiveDescendant.js';

type Props = { count: number; keys?: string[] };

function setup(initial: Props) {
  return renderHook(
    ({ count, keys }: Props) =>
      useActiveDescendant({ count, keys, baseId: 'x', onSelect: vi.fn() }),
    { initialProps: initial },
  );
}

describe('useActiveDescendant', () => {
  describe('without keys (Combobox): held by position', () => {
    it('clamps the stored index BEFORE applying the delta, so one ArrowUp moves the highlight after the list shrinks', () => {
      const { result, rerender } = setup({ count: 6 });
      act(() => result.current.moveActive(5));
      expect(result.current.activeIndex).toBe(5);

      rerender({ count: 2 });
      expect(result.current.activeIndex).toBe(1);
      expect(result.current.activeId).toBe('x-option-1');

      act(() => result.current.moveActive(-1));
      expect(result.current.activeIndex).toBe(0);
    });

    it('is -1 with no id when there are no options', () => {
      const { result } = setup({ count: 0 });
      expect(result.current.activeIndex).toBe(-1);
      expect(result.current.activeId).toBeUndefined();
    });
  });

  describe('with keys (#412): held by key', () => {
    it('follows the key when options are added above it', () => {
      const { result, rerender } = setup({ count: 2, keys: ['a', 'b'] });
      act(() => result.current.moveActive(1));

      rerender({ count: 4, keys: ['r1', 'r2', 'a', 'b'] });
      expect(result.current.activeIndex).toBe(3);

      act(() => result.current.moveActive(-1));
      expect(result.current.activeIndex).toBe(2);
    });

    it('falls back to the first option when the key is gone', () => {
      const { result, rerender } = setup({ count: 2, keys: ['a', 'b'] });
      act(() => result.current.moveActive(1));

      rerender({ count: 2, keys: ['r1', 'r2'] });
      expect(result.current.activeIndex).toBe(0);

      act(() => result.current.moveActive(1));
      expect(result.current.activeIndex).toBe(1);
    });

    it('does not jump back to a key that left and then returned', () => {
      const { result, rerender } = setup({ count: 2, keys: ['a', 'b'] });
      act(() => result.current.moveActive(1));

      rerender({ count: 2, keys: ['r1', 'r2'] });
      expect(result.current.activeIndex).toBe(0);

      rerender({ count: 3, keys: ['r1', 'b', 'r2'] });
      expect(result.current.activeIndex).toBe(0);
    });

    it('setActiveIndex holds the key at that index', () => {
      const { result, rerender } = setup({ count: 3, keys: ['a', 'b', 'c'] });
      act(() => result.current.setActiveIndex(2));

      rerender({ count: 3, keys: ['c', 'a', 'b'] });
      expect(result.current.activeIndex).toBe(0);
    });

    it('resetActive holds the top, not the key that was on top', () => {
      const { result, rerender } = setup({ count: 2, keys: ['a', 'b'] });
      act(() => result.current.moveActive(1));
      act(() => result.current.resetActive());

      rerender({ count: 2, keys: ['r1', 'a'] });
      expect(result.current.activeIndex).toBe(0);
    });

    it('keeps resetActive stable across renders that rebuild keys', () => {
      const { result, rerender } = setup({ count: 1, keys: ['a'] });
      const { resetActive, setActiveIndex } = result.current;
      rerender({ count: 1, keys: ['a'] });
      expect(result.current.resetActive).toBe(resetActive);
      expect(result.current.setActiveIndex).toBe(setActiveIndex);
    });
  });
});
