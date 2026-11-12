import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { UseControllableStateOptions } from './useControllableState.js';
import { useControllableState } from './useControllableState.js';

function setup<T>(initial: UseControllableStateOptions<T>) {
  return renderHook((options: UseControllableStateOptions<T>) => useControllableState(options), {
    initialProps: initial,
  });
}

describe('useControllableState', () => {
  describe('uncontrolled', () => {
    it('starts from defaultValue and owns every change after it', () => {
      const onChange = vi.fn();
      const { result } = setup<string>({ defaultValue: 'a', onChange });

      expect(result.current[0]).toBe('a');

      act(() => result.current[1]('b'));

      expect(result.current[0]).toBe('b');
      expect(onChange).toHaveBeenCalledExactlyOnceWith('b');
    });

    it('calls a function defaultValue once, as a lazy initialiser', () => {
      const init = vi.fn(() => ['x']);
      const { result, rerender } = setup<string[]>({ defaultValue: init });

      rerender({ defaultValue: init });
      act(() => result.current[1](['y']));

      expect(init).toHaveBeenCalledOnce();
      expect(result.current[0]).toEqual(['y']);
    });

    it('ignores a later defaultValue', () => {
      const { result, rerender } = setup<string>({ defaultValue: 'a' });

      rerender({ defaultValue: 'z' });

      expect(result.current[0]).toBe('a');
    });
  });

  describe('controlled', () => {
    it('reads value, and only reports a change without applying it', () => {
      const onChange = vi.fn();
      const { result } = setup<string>({ value: 'a', defaultValue: 'unused', onChange });

      act(() => result.current[1]('b'));

      expect(result.current[0]).toBe('a');
      expect(onChange).toHaveBeenCalledExactlyOnceWith('b');
    });

    it('follows value when the owner changes it', () => {
      const { result, rerender } = setup<string>({ value: 'a', defaultValue: '' });

      rerender({ value: 'b', defaultValue: '' });

      expect(result.current[0]).toBe('b');
    });

    it('treats null as a controlled value, not as uncontrolled', () => {
      const { result } = setup<string | null>({ value: null, defaultValue: 'seed' });

      act(() => result.current[1]('picked'));

      expect(result.current[0]).toBeNull();
    });
  });

  describe('switching mode mid-life', () => {
    it('controlled to uncontrolled falls back to internal state, which was never written while controlled', () => {
      const { result, rerender } = setup<string>({ value: 'owned', defaultValue: 'seed' });

      act(() => result.current[1]('ignored'));
      rerender({ value: undefined, defaultValue: 'seed' });

      expect(result.current[0]).toBe('seed');
    });

    it('uncontrolled to controlled hands the value to the owner and stops writing internal state', () => {
      const { result, rerender } = setup<string>({ defaultValue: 'seed' });

      act(() => result.current[1]('local'));
      rerender({ value: 'owned', defaultValue: 'seed' });
      expect(result.current[0]).toBe('owned');

      act(() => result.current[1]('ignored'));
      rerender({ value: undefined, defaultValue: 'seed' });
      expect(result.current[0]).toBe('local');
    });

    it('does not warn: a component that wants to warn does so itself', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = setup<string>({ value: 'a', defaultValue: '' });

      rerender({ value: undefined, defaultValue: '' });

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('setter identity', () => {
    it('keeps one setter across renders, mode switches and new callbacks', () => {
      const { result, rerender } = setup<string>({ defaultValue: 'a', onChange: () => {} });
      const first = result.current[1];

      rerender({ defaultValue: 'a', onChange: () => {} });
      rerender({ value: 'b', defaultValue: 'a', onChange: () => {} });
      act(() => result.current[1]('c'));

      expect(result.current[1]).toBe(first);
    });

    it('calls the latest onChange, not the one from the first render', () => {
      const stale = vi.fn();
      const fresh = vi.fn();
      const { result, rerender } = setup<string>({ defaultValue: 'a', onChange: stale });
      const setValue = result.current[1];

      rerender({ defaultValue: 'a', onChange: fresh });
      act(() => setValue('b'));

      expect(stale).not.toHaveBeenCalled();
      expect(fresh).toHaveBeenCalledExactlyOnceWith('b');
    });

    it('reads the latest mode when an old setter is called', () => {
      const { result, rerender } = setup<string>({ defaultValue: 'a' });
      const setValue = result.current[1];

      rerender({ value: 'owned', defaultValue: 'a' });
      act(() => setValue('ignored'));
      rerender({ value: undefined, defaultValue: 'a' });

      expect(result.current[0]).toBe('a');
    });
  });
});
