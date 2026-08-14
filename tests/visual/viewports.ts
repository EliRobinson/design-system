/* The two viewports every visual project draws from, kept here so the
   Storybook and docs sweeps cannot drift apart on the numbers. A baseline is
   only comparable to another baseline taken at the same width. */

export const WIDE_VIEWPORT = { width: 1280, height: 800 } as const;

export const NARROW_VIEWPORT = { width: 390, height: 844 } as const;
