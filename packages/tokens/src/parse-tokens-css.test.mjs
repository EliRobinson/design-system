import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { effectiveTokens, parseTokensCss } from './parse-tokens-css.mjs';

const tokensCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8');

describe('parseTokensCss', () => {
  const parsed = parseTokensCss(`
:root {
  --ink-500: #333; /* base ink */
  --fg: var(--ink-500);
  --shadow-focus: 0 0 0 2px var(--bg), 0 0 0 4px var(--fg);
  --bg: #fff;
}
`);

  it('reads names, raw values, and trailing comments', () => {
    expect(parsed[0]).toEqual({
      name: '--ink-500',
      value: '#333',
      comment: 'base ink',
      resolved: '#333',
    });
  });

  it('leaves the comment null when a declaration has none', () => {
    expect(parsed[1].comment).toBeNull();
  });

  it('follows var() chains so a reader gets a concrete value', () => {
    expect(parsed[1]).toMatchObject({ name: '--fg', value: 'var(--ink-500)', resolved: '#333' });
  });

  it('resolves every var() in a multi-part value, in either direction', () => {
    // --bg is declared *after* --shadow-focus references it.
    expect(parsed[2].resolved).toBe('0 0 0 2px #fff, 0 0 0 4px #333');
  });

  it('leaves an unknown var() reference alone rather than emptying it', () => {
    expect(parseTokensCss(':root {\n  --a: var(--nope);\n}')[0].resolved).toBe('var(--nope)');
  });

  it('gives up on a var() cycle instead of recursing forever', () => {
    const cyclic = parseTokensCss(':root {\n  --a: var(--b);\n  --b: var(--a);\n}');
    expect(cyclic.map((token) => token.name)).toEqual(['--a', '--b']);
    expect(cyclic[0].resolved).toContain('var(--');
  });

  it('returns nothing rather than throwing when there is no :root block', () => {
    expect(parseTokensCss('.thing { color: red; }')).toEqual([]);
  });

  it('ignores declarations outside :root', () => {
    const names = parseTokensCss(tokensCss).map((token) => token.name);
    // --focus-ring is re-declared inside the dark block; only :root is a token
    // source, so it must appear exactly once.
    expect(names.filter((name) => name === '--focus-ring')).toHaveLength(1);
  });

  it('keeps duplicate declarations in source order so callers can apply last-wins', () => {
    const successes = parseTokensCss(tokensCss).filter(
      (token) => token.name === '--status-success',
    );
    expect(successes).toHaveLength(2);
    expect(successes.at(-1).value).toBe('var(--anchor-500)');
  });
});

describe('effectiveTokens', () => {
  it('applies CSS last-declaration-wins', () => {
    const effective = effectiveTokens(parseTokensCss(tokensCss));
    expect(effective.get('--status-success').value).toBe('var(--anchor-500)');
    expect(effective.get('--status-success').resolved).toBe('oklch(42% 0.08 156)');
  });
});

describe('the shipped tokens.css', () => {
  it('parses into the token set the rest of the monorepo reads', () => {
    const parsed = parseTokensCss(tokensCss);
    expect(new Set(parsed.map((token) => token.name)).size).toBeGreaterThanOrEqual(151);
    expect(parsed.every((token) => token.value.length > 0)).toBe(true);
  });

  it('resolves every semantic token to a value with no var() left in it', () => {
    for (const token of parseTokensCss(tokensCss)) {
      expect(token.resolved, token.name).not.toContain('var(');
    }
  });
});
