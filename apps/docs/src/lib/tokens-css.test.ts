import { describe, expect, it } from 'vitest';

import { cssTokens, getToken, tokensByPrefix } from './tokens-css';

describe('tokens.css parsing', () => {
  it('finds the full token surface (roughly 120 properties)', () => {
    expect(cssTokens().length).toBeGreaterThan(110);
  });

  it('captures the ink scale with its comments', () => {
    const ink = tokensByPrefix('ink');
    expect(ink).toHaveLength(13);
    expect(getToken('--ink-0')?.comment).toContain('white');
  });

  it('resolves semantic var() chains to concrete values', () => {
    expect(getToken('--bg')?.resolved).toBe('#ffffff');
    expect(getToken('--accent')?.resolved).toBe('oklch(72.5% 0.175 65)');
    expect(getToken('--status-success')?.resolved).toBe('oklch(42% 0.08 156)');
  });

  it('keeps raw values intact for non-color tokens', () => {
    expect(getToken('--space-4')?.value).toBe('16px');
    expect(getToken('--radius-pill')?.value).toBe('999px');
    expect(getToken('--dur-fast')?.value).toBe('140ms');
  });
});
