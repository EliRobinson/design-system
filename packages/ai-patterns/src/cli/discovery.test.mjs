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

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { COMBINATIONS, defaultValueOf, tokenDials } from '@elirobinson/tokens/dials';
import { effectiveTokens, parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import {
  TOKEN_STYLESHEETS as PACKAGE_STYLESHEETS,
  readPlatformStylesheets,
  readTokenStylesheets,
} from '@elirobinson/tokens/token-stylesheets';
import { afterEach, describe, expect, it } from 'vitest';

import { cssVariables, loadDials, TOKEN_STYLESHEETS } from './discovery.mjs';

/* Through the exports map, so this reads the same files `ds` reads out of a
   consumer's node_modules rather than paths relative to the monorepo layout. */
const require = createRequire(import.meta.url);
const srcDir = dirname(require.resolve('@elirobinson/tokens/tokens.css'));
const tokensDir = dirname(srcDir);
const stylesheets = readTokenStylesheets(srcDir);
const platformCss = readPlatformStylesheets(srcDir);

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

/* `cssVariables` is the DEFAULT COMBINATION's reader, and the pin above only
   says it agrees with the shared parser about that one column. This says which
   column it is. Without it, "the default combination" is a claim in a comment;
   with it, a change to either reader that moved `ds tokens`'s unlabelled rows
   off `ember/light` fails here. */
describe('cssVariables and the dial roster', () => {
  const entries = tokenDials(stylesheets, { platformCss });

  it('reads exactly the default combination, in the same order', () => {
    expect(cssVariables(stylesheets).map(({ name }) => name)).toEqual(
      entries.map(({ name }) => name),
    );
  });

  it('agrees on every value it does not have to follow a var() chain to reach', () => {
    /* The one difference between the two, and it is by design: `tokenDials`
       resolves — `--accent` comes back as the colour ember's signal ramp lands
       on, where this reader returns the `var(--signal-500)` the file declares.
       So the values are compared where there is no indirection to disagree
       about, which is most of them, and the names are compared everywhere. */
    const direct = cssVariables(stylesheets).filter(({ value }) => !value.includes('var('));
    expect(direct.length).toBeGreaterThan(0);

    for (const { name, value } of direct) {
      const entry = entries.find((candidate) => candidate.name === name);
      expect(defaultValueOf(entry), name).toBe(value);
    }
  });

  it('cannot see the combinations that are not the default, which is why loadDials exists', () => {
    // The bug this whole path closes: four values, one of them reachable.
    const varying = entries.filter((entry) => entry.varies);
    expect(varying.length).toBeGreaterThan(0);
    expect(varying[0].values).toHaveLength(COMBINATIONS.length);
    expect(cssVariables(stylesheets).filter(({ name }) => name === varying[0].name)).toHaveLength(
      1,
    );
  });
});

describe('loadDials', () => {
  const roots = [];

  afterEach(() => {
    while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
  });

  /** A node_modules-shaped @elirobinson/tokens carrying exactly these files. */
  function installedTokens(files) {
    const root = mkdtempSync(join(tmpdir(), 'ds-tokens-'));
    roots.push(root);
    for (const [path, contents] of Object.entries(files)) {
      const full = join(root, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents);
    }
    return root;
  }

  it('loads the roster and the stylesheets from the installed package', async () => {
    const loaded = await loadDials({ tokens: tokensDir });

    expect(loaded).not.toBeNull();
    expect(loaded.sources).toEqual(stylesheets);
    expect(loaded.platformCss).toEqual(platformCss);
    // The roster arrives from the package, so it is the package's list.
    expect(loaded.dials.COMBINATIONS.map(({ id }) => id)).toEqual(COMBINATIONS.map(({ id }) => id));
    expect(loaded.dials.tokenDials(loaded.sources, { platformCss: loaded.platformCss })).toEqual(
      tokenDials(stylesheets, { platformCss }),
    );
  });

  it('returns null when the package is not installed, rather than throwing', async () => {
    await expect(loadDials({ tokens: null })).resolves.toBeNull();
    await expect(loadDials({})).resolves.toBeNull();
    await expect(loadDials(null)).resolves.toBeNull();
  });

  it('returns null for an install that predates the roster', async () => {
    // The shape every tokens package had before dials.mjs existed.
    const tokens = installedTokens({ 'src/tokens.css': ':root {\n  --x: a;\n}\n' });

    await expect(loadDials({ tokens })).resolves.toBeNull();
  });

  it('returns null for an install with the roster but no platform reader', async () => {
    /* The half-way release: dials.mjs shipped, and the reader for the platform
       layer arrived after it. Detected by asking for the function rather than
       by comparing a version string, because a version tells you nothing about
       a consumer who has patched their install. */
    const tokens = installedTokens({
      'src/dials.mjs': 'export function tokenDials() {\n  return [];\n}\n',
      'src/token-stylesheets.mjs': 'export function readTokenStylesheets() {\n  return [];\n}\n',
    });

    await expect(loadDials({ tokens })).resolves.toBeNull();
  });

  it('returns null rather than throwing on a module that will not import', async () => {
    const tokens = installedTokens({
      'src/dials.mjs': 'export function tokenDials( {\n',
      'src/token-stylesheets.mjs': 'export function readTokenStylesheets() {}\n',
    });

    await expect(loadDials({ tokens })).resolves.toBeNull();
  });
});
