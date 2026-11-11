import { describe, expect, it } from 'vitest';

import { aaVerdict, colorsIn, contrastRatio, parseColor, toHex } from './color.mjs';

/* The shape the neutral ramp resolves to once --n-mult is substituted. */
const INK_500 = 'oklch(55% calc(0.008 * 1) 247)';
const INK_500_FLAT = 'oklch(55% 0.008 247)';

describe('calc() inside oklch()', () => {
  it('parses a product of two literals the same as the flattened value', () => {
    expect(parseColor(INK_500)).toEqual(parseColor(INK_500_FLAT));
    expect(parseColor(INK_500)).not.toBeNull();
  });

  it('gives the ink scale a hex value', () => {
    expect(toHex(INK_500)).toBe(toHex(INK_500_FLAT));
    expect(toHex(INK_500)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('measures contrast for a calc() colour', () => {
    expect(contrastRatio(INK_500, '#ffffff')).toBeCloseTo(
      contrastRatio(INK_500_FLAT, '#ffffff'),
      6,
    );
    expect(contrastRatio(INK_500, '#ffffff')).not.toBeNull();
  });

  it('finds the whole calc() colour in a value', () => {
    expect(colorsIn(`0 1px 2px ${INK_500}`)).toEqual([INK_500]);
  });
});

describe('aaVerdict', () => {
  it('grades text at 4.5 and 3', () => {
    expect(aaVerdict(4.5)).toBe('AA');
    expect(aaVerdict(3.2)).toBe('AA large only');
    expect(aaVerdict(2.9)).toBe('fails AA');
  });

  it('grades non-text against 3:1 only, never "large only"', () => {
    expect(aaVerdict(3.0, 'non-text')).toBe('AA');
    expect(aaVerdict(3.9, 'non-text')).toBe('AA');
    expect(aaVerdict(2.9, 'non-text')).toBe('fails AA');
  });
});
