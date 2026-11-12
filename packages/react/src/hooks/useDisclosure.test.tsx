import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDisclosure } from './useDisclosure.js';

describe('useDisclosure', () => {
  it('keeps its own shape: closed by default, and setOpen is stable', () => {
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(() => useDisclosure({ onOpenChange }));
    const { setOpen } = result.current;

    expect(result.current.open).toBe(false);
    act(() => setOpen(true));
    rerender();

    expect(result.current.open).toBe(true);
    expect(result.current.setOpen).toBe(setOpen);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('a controlled open is reported but not applied', () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() => useDisclosure({ open: false, onOpenChange }));

    act(() => result.current.setOpen(true));

    expect(result.current.open).toBe(false);
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});
