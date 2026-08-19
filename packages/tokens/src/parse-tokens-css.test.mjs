import { describe, expect, it } from 'vitest';

import { effectiveTokens, parseTokensCss } from './parse-tokens-css.mjs';
import { readTokenStylesheets } from './token-stylesheets.mjs';

/* The real files, in cascade order. Everything below that says "the shipped
   stylesheets" means this array and not tokens.css on its own: tokens.css
   @imports palettes.css, so a single-file read is a browser nobody has. */
const stylesheets = readTokenStylesheets();

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

  it('falls back the way a browser does when the referenced property is undeclared', () => {
    // How the --ds-font-*-override hook on the family tokens resolves for a
    // consumer who has not set one.
    const parsed = parseTokensCss(":root {\n  --a: var(--nope, 'Geist', sans-serif);\n}");
    expect(parsed[0].resolved).toBe(`'Geist', sans-serif`);
  });

  it('prefers the declared value over the fallback, again as a browser would', () => {
    const parsed = parseTokensCss(':root {\n  --set: #fff;\n  --a: var(--set, #000);\n}');
    expect(parsed.at(-1).resolved).toBe('#fff');
  });

  it('reads a var() whose fallback contains commas and nested parens', () => {
    const parsed = parseTokensCss(
      ":root {\n  --b: 12px;\n  --a: var(--nope, var(--b), 'Segoe UI') solid;\n}",
    );
    expect(parsed.at(-1).resolved).toBe(`12px, 'Segoe UI' solid`);
  });

  it('puts a value Prettier wrapped across lines back on one line', () => {
    const parsed = parseTokensCss(
      ':root {\n  --a: var(\n    --nope,\n    Menlo,\n    monospace\n  );\n}',
    );
    expect(parsed[0].value).toBe('var(--nope, Menlo, monospace)');
  });

  it('reads a declaration written inside a comment as prose, not as a token', () => {
    // tokens.css documents the override hook with a snippet in a comment.
    const parsed = parseTokensCss(
      ':root {\n  /* set --ds-font-sans-override: var(--font-geist-sans); to re-point it */\n  --a: 1px;\n}',
    );
    expect(parsed.map((token) => token.name)).toEqual(['--a']);
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
    const names = parseTokensCss(stylesheets).map((token) => token.name);
    /* --focus-ring is declared once in palettes.css's `:root` and then three
       more times — the dark block, and both slate blocks. Only `:root` is a
       token source, so across the whole roster it must appear exactly once.
       This is the assertion that would notice a parser that started reading
       `[data-theme='dark']` as if it were a default. */
    expect(names.filter((name) => name === '--focus-ring')).toHaveLength(1);
  });

  it('keeps duplicate declarations in source order so callers can apply last-wins', () => {
    /* Pinned on a fixture. This used to read --status-success out of the real
       stylesheet, where it was declared twice — but that duplication was a bug,
       not a demonstration: the second declaration re-pointed the success fill
       at the brand's --anchor-500, which made a success badge change colour
       with the palette. The palette split fixed it, and a test that needed the
       bug to exist would have blocked the fix. */
    const parsed = parseTokensCss(':root {\n  --a: 1px;\n  --b: 2px;\n  --a: 3px;\n}');
    expect(parsed.map((token) => token.name)).toEqual(['--a', '--b', '--a']);
    expect(parsed.filter((token) => token.name === '--a').at(-1).value).toBe('3px');
  });
});

describe('parseTokensCss across several stylesheets', () => {
  it('concatenates the declarations in the order the sources are given', () => {
    const parsed = parseTokensCss([':root {\n  --a: 1px;\n}', ':root {\n  --b: 2px;\n}']);
    expect(parsed.map((token) => token.name)).toEqual(['--a', '--b']);
  });

  it('lets a later stylesheet win, because the sources are in cascade order', () => {
    // @imported files first, the way a browser flattens them: palettes.css is
    // the earlier source, so tokens.css's own `:root` is the one that wins a
    // tie. Reverse the arguments and the answer reverses with them, which is
    // exactly why TOKEN_STYLESHEETS is ordered and not a set.
    const sources = [':root {\n  --a: 1px;\n}', ':root {\n  --a: 2px;\n}'];
    expect(effectiveTokens(parseTokensCss(sources)).get('--a').value).toBe('2px');
    expect(effectiveTokens(parseTokensCss([...sources].reverse())).get('--a').value).toBe('1px');
  });

  it('resolves a var() chain that crosses a file boundary', () => {
    /* The failure the array form exists to prevent. tokens.css declares
       `--fg-on-signal: var(--accent-fg)` and palettes.css declares
       `--accent-fg`; read tokens.css alone and that value resolves to itself. */
    const [onSignal] = parseTokensCss([
      ':root {\n  --accent-fg: #000000;\n}',
      ':root {\n  --fg-on-signal: var(--accent-fg);\n}',
    ]).slice(-1);
    expect(onSignal.resolved).toBe('#000000');
    expect(parseTokensCss(':root {\n  --fg-on-signal: var(--accent-fg);\n}')[0].resolved).toBe(
      'var(--accent-fg)',
    );
  });

  it('takes a single string as the one-source case of the same thing', () => {
    expect(parseTokensCss(':root {\n  --a: 1px;\n}')).toEqual(
      parseTokensCss([':root {\n  --a: 1px;\n}']),
    );
  });
});

describe('effectiveTokens', () => {
  it('applies CSS last-declaration-wins', () => {
    const effective = effectiveTokens(parseTokensCss(':root {\n  --a: 1px;\n  --a: 2px;\n}'));
    expect(effective.get('--a').value).toBe('2px');
  });

  it('reduces the shipped stylesheets to one entry per name', () => {
    const parsed = parseTokensCss(stylesheets);
    const effective = effectiveTokens(parsed);
    // Every name has exactly one `:root` home now, so nothing is collapsed —
    // and that equality is the cheapest statement of it there is.
    expect(effective.size).toBe(parsed.length);
    /* --status-success in particular: it was declared twice, the second time
       re-pointed at --anchor-500, which tied a success badge to the brand. It
       is declared once now and must stay that way. */
    expect(parsed.filter((token) => token.name === '--status-success')).toHaveLength(1);
    expect(effective.get('--status-success').value).toBe('oklch(51.9% 0.145 150)');
  });
});

describe('the shipped stylesheets', () => {
  it('parses into the token set the rest of the monorepo reads', () => {
    const parsed = parseTokensCss(stylesheets);
    expect(new Set(parsed.map((token) => token.name)).size).toBeGreaterThanOrEqual(196);
    expect(parsed.every((token) => token.value.length > 0)).toBe(true);
  });

  it('resolves every token to a value with no var() left in it', () => {
    /* The best canary in the repo: a var() surviving into `resolved` means some
       reader — the docs foundations pages, `ds tokens`, the llms snapshot —
       is about to print `var(--accent-fg)` where a colour belongs. It is also
       the assertion that catches a typo'd reference, since an undeclared name
       without a fallback is left as written rather than emptied.

       It has to sweep the whole roster and not tokens.css alone. On tokens.css
       alone 26 tokens fail it, every one of them correctly: the ink ramp reads
       --n-mult and --n-h, --fg-on-signal reads --accent-fg, and all of those
       are declared in palettes.css. Narrowing the sweep to make it pass would
       have thrown away the only test that notices the split going wrong.

       calc() in a resolved value is fine and is not a var() in disguise.
       `resolved` is the declared value with its var() chains followed, not a
       computed value — no node test computes CSS — so --ink-500 resolves to
       `oklch(55% calc(0.008 * 1) 247)`. That is a legitimate CSS colour a
       browser evaluates to a grey; the substitution this test cares about has
       already happened. */
    for (const token of parseTokensCss(stylesheets)) {
      expect(token.resolved, token.name).not.toContain('var(');
    }
  });
});
