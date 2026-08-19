/* Pins `cssVariables` — and the roster it is fed — to @elirobinson/tokens.
 *
 * The CLI cannot import that package at run time without taking a runtime
 * dependency on it, which would defeat the "degrades gracefully when the
 * package is not installed" property (see the comments in discovery.mjs). A
 * dev-time dependency and this test are the substitute, and after the palette
 * split there are two copies to pin, not one: the parser, and the list of
 * files to hand it. Either drifting is a `ds tokens` that prints a system
 * missing its brand.
 */

import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

import { effectiveTokens, parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import {
  TOKEN_STYLESHEETS as PACKAGE_STYLESHEETS,
  readTokenStylesheets,
} from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import { cssVariables, TOKEN_STYLESHEETS } from './discovery.mjs';

/* Through the exports map, so this reads the same files `ds` reads out of a
   consumer's node_modules rather than paths relative to the monorepo layout. */
const srcDir = dirname(createRequire(import.meta.url).resolve('@elirobinson/tokens/tokens.css'));
const stylesheets = readTokenStylesheets(srcDir);

describe('the roster', () => {
  it('is the list @elirobinson/tokens publishes, in the same order', () => {
    // Cascade order, not just membership: last-declaration-wins depends on it.
    expect(TOKEN_STYLESHEETS).toEqual(PACKAGE_STYLESHEETS);
  });
});

describe('cssVariables', () => {
  it('reads the same names and effective values as the shared parser', () => {
    const shared = [...effectiveTokens(parseTokensCss(stylesheets)).values()].map(
      ({ name, value }) => ({ name, value }),
    );

    expect(cssVariables(stylesheets)).toEqual(shared);
  });

  it('returns nothing rather than throwing when the package is not installed', () => {
    expect(cssVariables(null)).toEqual([]);
  });

  it('ignores declarations outside :root', () => {
    const names = cssVariables(stylesheets).map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('--focus-ring');
  });

  it('reads the brand, which lives in a file that is not tokens.css', () => {
    /* The palette split's failure mode: tokens.css alone still parses and
       still yields a few hundred rows, and `ds tokens` would print the whole
       system with no brand in it and nothing amiss on screen. */
    const tokensCssOnly = readFileSync(`${srcDir}/tokens.css`, 'utf8');
    const namesIn = (css) => new Set(cssVariables(css).map(({ name }) => name));

    expect(namesIn(tokensCssOnly).has('--accent')).toBe(false);
    expect(namesIn(stylesheets).has('--accent')).toBe(true);
    for (const name of ['--accent-fg', '--signal-500', '--anchor-500', '--focus-ring']) {
      expect(namesIn(stylesheets), name).toContain(name);
    }
  });

  it('applies last-declaration-wins across files, not just within one', () => {
    const [first, second] = [':root {\n  --x: a;\n}', ':root {\n  --x: b;\n}'];
    expect(cssVariables([first, second])).toEqual([{ name: '--x', value: 'b' }]);
  });
});
