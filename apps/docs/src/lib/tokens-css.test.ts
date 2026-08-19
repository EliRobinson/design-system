import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TOKEN_STYLESHEETS } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import { cssTokens, getToken, tokensByPrefix } from './tokens-css';

describe('token stylesheet parsing', () => {
  it('parses every custom property the token stylesheets declare', () => {
    /* Compared against an independent count of the same thing the parser
       reads — declarations in the first :root block of every stylesheet on the
       roster, comments blanked so a documented example is prose, not a token.
       196 as this was written: 71 in palettes.css and 125 in tokens.css.

       The old floor of 110 against an actual 153 let 42 tokens vanish
       silently. Counting tokens.css against tokens.css would have been the
       same bug one layer up: the palette split moved 71 declarations out of
       the file, and a count that reads only what the reader reads agrees with
       a missing brand as readily as with a present one. That is what the next
       test is for. */
    const declared = TOKEN_STYLESHEETS.flatMap((name) => {
      const raw = readFileSync(
        join(process.cwd(), 'node_modules/@elirobinson/tokens/src', name),
        'utf8',
      );
      const root = raw.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
      return root.replace(/\/\*[\s\S]*?\*\//g, ' ').match(/--[\w-]+\s*:/g) ?? [];
    });
    expect(TOKEN_STYLESHEETS.length).toBeGreaterThan(1);
    expect(declared.length).toBeGreaterThan(0);
    expect(cssTokens()).toHaveLength(declared.length);
  });

  it('reads the palette layer, not tokens.css on its own', () => {
    /* The failure mode the roster exists to prevent: tokens.css alone still
       parses, still returns a couple of hundred declarations, and simply has
       no brand in it. --signal-500 is declared only in palettes.css and
       --space-4 only in tokens.css, so both present means the cascade was read
       whole — and --fg-on-signal resolving to black rather than to the literal
       `var(--accent-fg)` means it was read in the right ORDER. */
    expect(getToken('--signal-500')?.value).toBe('oklch(72.5% 0.175 65)');
    expect(getToken('--space-4')?.value).toBe('16px');
    expect(getToken('--fg-on-signal')?.resolved).toBe('#000000');
  });

  it('captures the ink scale with its comments', () => {
    const ink = tokensByPrefix('ink');
    expect(ink).toHaveLength(13);
    expect(getToken('--ink-0')?.comment).toContain('white');
  });

  it('resolves semantic var() chains to concrete values', () => {
    expect(getToken('--bg')?.resolved).toBe('#ffffff');
    expect(getToken('--accent')?.resolved).toBe('oklch(72.5% 0.175 65)');
    /* Success is its own hue now. It used to be --anchor-500, which made a
       success badge the exact color of the secondary brand fill. */
    expect(getToken('--status-success')?.resolved).toBe('oklch(51.9% 0.145 150)');
  });

  it('keeps raw values intact for non-color tokens', () => {
    expect(getToken('--space-4')?.value).toBe('16px');
    expect(getToken('--radius-pill')?.value).toBe('999px');
    expect(getToken('--dur-fast')?.value).toBe('140ms');
  });
});
