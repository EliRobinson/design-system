/* The dial roster, pinned to the stylesheets it claims to describe.
 *
 * Every surface that reports the dials — `ds dials`, `ds tokens`, the MCP
 * server, the guideline cards, the scaffolded app's bootstrap — reads
 * dials.mjs. So the one thing that must not be possible is dials.mjs and the
 * CSS disagreeing: a `[data-palette='forest']` block with no entry in
 * `PALETTES` would be invisible in all five at once, which is precisely the
 * class of bug the roster exists to close.
 *
 * Both directions are checked, because they fail differently. A block with no
 * roster entry is a palette nobody can discover; a roster entry with no block
 * is a palette every surface offers and the stylesheet does not implement.
 */

import { describe, expect, it } from 'vitest';

import { COMBINATIONS, combinationValues } from './contrast.mjs';
import {
  DEFAULT_PALETTE,
  DEFAULT_PLATFORM,
  DEFAULT_THEME,
  DIALS,
  PALETTES,
  PLATFORMS,
  THEMES,
  declaredPalettes,
  declaredPlatforms,
  defaultCombinationId,
  defaultValueOf,
  dialAttributeString,
  dialAttributes,
  dialNamed,
  dialOwnership,
  platformOverrides,
  tokenDials,
} from './dials.mjs';
import { effectiveTokens, parseTokensCss } from './parse-tokens-css.mjs';
import { readPlatformStylesheets, readTokenStylesheets } from './token-stylesheets.mjs';

const sources = readTokenStylesheets();
const platformCss = readPlatformStylesheets();

/* A dial's non-default values are the ones that need a selector; the default
   is the value you get with no attribute at all, so it never appears in one. */
const selectable = (values, fallback) => values.filter((value) => value !== fallback).sort();

describe('the roster and the stylesheets', () => {
  it('lists exactly the palettes palettes.css declares blocks for', () => {
    expect(declaredPalettes(sources)).toEqual(selectable(PALETTES, DEFAULT_PALETTE));
  });

  it('lists exactly the platforms mobile.css declares blocks for', () => {
    expect(declaredPlatforms(platformCss)).toEqual(selectable(PLATFORMS, DEFAULT_PLATFORM));
  });

  it('has a default for every dial that is one of its own values', () => {
    for (const dial of DIALS) {
      expect(dial.values, dial.name).toContain(dial.default);
    }
  });

  it('names the three attributes, each dial once', () => {
    expect(DIALS.map((dial) => dial.attribute)).toEqual([
      'data-palette',
      'data-theme',
      'data-platform',
    ]);
    expect(dialNamed('palette').values).toBe(PALETTES);
    expect(dialNamed('nope')).toBeUndefined();
  });
});

describe('combinations', () => {
  it('is every palette against every theme', () => {
    expect(COMBINATIONS).toHaveLength(PALETTES.length * THEMES.length);
    for (const { palette, theme, id } of COMBINATIONS) {
      expect(id).toBe(`${palette}/${theme}`);
    }
  });

  it('names the attribute-free selection as the default combination', () => {
    expect(defaultCombinationId()).toBe(`${DEFAULT_PALETTE}/${DEFAULT_THEME}`);
    expect(COMBINATIONS.map((combination) => combination.id)).toContain(defaultCombinationId());
  });
});

describe('dialAttributes', () => {
  it('writes nothing for a selection that is entirely defaults', () => {
    expect(dialAttributes({})).toEqual({});
    expect(
      dialAttributes({
        palette: DEFAULT_PALETTE,
        theme: DEFAULT_THEME,
        platform: DEFAULT_PLATFORM,
      }),
    ).toEqual({});
    expect(dialAttributeString({ palette: DEFAULT_PALETTE })).toBe('');
  });

  it('writes only the dials that are off their default', () => {
    expect(dialAttributeString({ palette: 'slate', theme: 'dark', platform: 'mobile' })).toBe(
      'data-palette="slate" data-theme="dark" data-platform="mobile"',
    );
    expect(dialAttributeString({ theme: 'dark' })).toBe('data-theme="dark"');
  });
});

describe('platformOverrides', () => {
  it('reports what data-platform="mobile" re-points', () => {
    const overrides = platformOverrides(platformCss);
    const byName = new Map(overrides.map(({ name, value }) => [name, value]));

    expect(byName.get('--radius-sm')).toBe('8px');
    expect(byName.get('--gutter')).toBe('16px');
    expect(byName.get('--container-sm')).toBe('100%');
  });

  it('declares no colour — the invariant every measured ratio depends on', () => {
    /* mobile.css's header states this as a rule rather than a coincidence: a
       platform layer that moved one colour would invalidate every ratio in
       contrast.test.mjs silently, because those assertions read the tokens
       this file does not touch. Asserted here rather than trusted, by name
       rather than by parsing colour: nothing the palette or theme dial owns
       may also be on the platform dial. */
    const ownership = dialOwnership(sources, platformCss);
    const coloured = new Set([...ownership.palette, ...ownership.theme]);
    expect(ownership.platform.filter((name) => coloured.has(name))).toEqual([]);
  });

  it('is empty for the default platform, and for no stylesheet at all', () => {
    expect(platformOverrides(platformCss, DEFAULT_PLATFORM)).toEqual([]);
    expect(platformOverrides(null)).toEqual([]);
  });
});

describe('tokenDials', () => {
  const all = tokenDials(sources, { platformCss });
  const byName = new Map(all.map((entry) => [entry.name, entry]));

  it('reports every combination for every token, agreed or not', () => {
    for (const entry of all) {
      expect(
        entry.values.map((value) => value.combination),
        entry.name,
      ).toEqual(COMBINATIONS.map((combination) => combination.id));
    }
  });

  it('resolves each cell exactly as combinationValues does — one resolver, not two', () => {
    for (const combination of COMBINATIONS) {
      const expected = combinationValues(sources, combination);
      for (const entry of all) {
        const cell = entry.values.find((value) => value.combination === combination.id);
        expect(cell.value, `${entry.name} in ${combination.id}`).toBe(
          expected.get(entry.name) ?? null,
        );
      }
    }
  });

  it('covers the same names the shared parser reads for the default combination', () => {
    const shared = [...effectiveTokens(parseTokensCss(sources)).keys()];
    expect([...byName.keys()].sort()).toEqual([...shared].sort());
  });

  it('marks a token that moves with the palette, and one that does not', () => {
    expect(byName.get('--accent').varies).toBe(true);
    expect(byName.get('--space-4').varies).toBe(false);
    expect(defaultValueOf(byName.get('--accent'))).toBe(
      combinationValues(sources, COMBINATIONS[0]).get('--accent'),
    );
  });

  it('carries the platform override on the token itself, not only in a list', () => {
    /* Gap 3's whole point: `ds tokens radius-sm` printing the desktop value
       with nothing saying it moves is the bug, and a dials-only report leaves
       the filtered query still lying. */
    expect(byName.get('--radius-sm').platforms).toEqual([{ platform: 'mobile', value: '8px' }]);
    expect(byName.get('--radius-none').platforms).toEqual([]);
  });
});
