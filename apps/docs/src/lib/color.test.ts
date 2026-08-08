import { describe, expect, it } from 'vitest';

import { aaVerdict, contrastRatio, toHex } from './color';

const AMBER = 'oklch(72.5% 0.175 65)';

describe('color math', () => {
  it('round-trips hex values', () => {
    expect(toHex('#ffffff')).toBe('#ffffff');
    expect(toHex('#000000')).toBe('#000000');
  });

  it('converts oklch white and black to the pinned hex endpoints', () => {
    expect(toHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(toHex('oklch(0% 0 0)')).toBe('#000000');
  });

  it('gives white on black the maximum 21:1 ratio', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });

  it('matches the brand README checksum: amber on ink-1000 ≈ 8.7:1', () => {
    const ratio = contrastRatio(AMBER, '#000000');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThan(8.2);
    expect(ratio!).toBeLessThan(9.2);
  });

  it('ignores alpha in shadow-style oklch values', () => {
    expect(toHex('oklch(0% 0 0 / 0.04)')).toBe('#000000');
  });

  it('maps ratios to AA verdicts at the WCAG thresholds', () => {
    expect(aaVerdict(4.5)).toBe('AA');
    expect(aaVerdict(3.2)).toBe('AA large only');
    expect(aaVerdict(2.9)).toBe('fails AA');
  });
});
