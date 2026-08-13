import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cssTokens, getToken, tokensByPrefix } from './tokens-css';

describe('tokens.css parsing', () => {
  it('parses every custom property tokens.css declares', () => {
    /* Compared against an independent count of the same thing the parser
       reads — declarations in the first :root block, comments blanked so a
       documented example is prose, not a token. The old floor of 110 against
       an actual 153 let 42 tokens vanish silently. */
    const raw = readFileSync(
      join(process.cwd(), 'node_modules/@elirobinson/tokens/src/tokens.css'),
      'utf8',
    );
    const root = raw.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const declared = root.replace(/\/\*[\s\S]*?\*\//g, ' ').match(/--[\w-]+\s*:/g) ?? [];
    expect(declared.length).toBeGreaterThan(0);
    expect(cssTokens()).toHaveLength(declared.length);
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
