/* The three dials, as data.
 *
 * `tokens.css` resolves under three independent attributes on the root
 * element — `data-palette`, `data-theme` and `data-platform` — and until this
 * file existed the only place that fact was written down was prose: the
 * stylesheet headers, the changeset, and whatever a consumer had copied into
 * their own docs. Prose is exactly what this repo may not ship (see
 * CLAUDE.md), because a third palette makes every copy of it wrong at once and
 * nothing fails.
 *
 * So the dials ship as a queryable roster instead, and every surface that
 * reports them — `ds dials`, `ds tokens`, the MCP server, the guideline cards,
 * the scaffolded app's bootstrap — reads THIS, never a list of its own.
 *
 * The roster is not restated here either. `PALETTES`, `THEMES`,
 * `COMBINATIONS` and `DEFAULT_PALETTE` come from ./contrast.mjs, which has
 * owned them since the palette split and whose `unreadableSelectors` already
 * fails the build on a palette block the list does not know about. This file
 * adds only what contrast.mjs has no business owning:
 *
 *   - The PLATFORM dial. mobile.css declares no colour, deliberately and
 *     load-bearingly (its own header explains that a platform layer which
 *     moved one colour would invalidate every measured ratio silently), so the
 *     platform axis sits entirely outside the contrast contract.
 *   - The attribute vocabulary — which attribute selects which dial, and which
 *     value is the one you get by leaving the attribute off.
 *
 * ---------------------------------------------------------------------------
 * The naming every surface uses
 * ---------------------------------------------------------------------------
 * A COMBINATION is `<palette>/<theme>` — `COMBINATIONS[].id` from
 * contrast.mjs, spelled exactly that way wherever it is printed: `ember/light`,
 * `slate/dark`. One name, one separator, everywhere; a surface that prints
 * `ember · light` or `ember-light` has invented a second vocabulary for the
 * same thing.
 *
 * The PLATFORM is a third, orthogonal axis and is never folded into a
 * combination id. Because mobile.css changes no colour, `ember/light` and
 * `ember/light on mobile` have identical colour and differ in twelve
 * geometry and type tokens; printing eight combinations would be four columns
 * of duplicates burying the twelve values that actually move. A token the
 * platform layer re-points is reported as an override *on top of* the
 * combinations, labelled with its platform name and its selector.
 *
 * A SELECTION is written as root-element attributes with every default
 * omitted, because an absent attribute IS the default: `ember`, `light`,
 * `desktop`. `dialAttributes` is the one place that rule is implemented.
 */

import {
  COMBINATIONS,
  DEFAULT_PALETTE,
  PALETTES,
  THEMES,
  combinationValues,
  tokenBlocks,
} from './contrast.mjs';

export { COMBINATIONS, DEFAULT_PALETTE, PALETTES, THEMES } from './contrast.mjs';

/**
 * The platforms the system defines.
 *
 * `desktop` is not a selector and never appears in a stylesheet — it is the
 * name of what you get with no `data-platform` attribute, and it is in the
 * list so that a surface enumerating the dial's values has something honest to
 * print for the default rather than an empty string.
 *
 * Declared rather than scraped, for the same reason `PALETTES` is: a declared
 * list plus a test that pins it to the stylesheets (`declaredPlatforms`) fails
 * loudly when the two disagree, where scraping would silently agree with
 * whatever was there.
 */
export const PLATFORMS = ['desktop', 'mobile'];

/** The theme `:root` alone declares — the one with no attribute set. */
export const DEFAULT_THEME = THEMES[0];

/** The platform with no attribute set. */
export const DEFAULT_PLATFORM = PLATFORMS[0];

/**
 * The three dials, in the order a reader should meet them.
 *
 * `owns` is a one-line summary of which families move with the dial. It is the
 * only prose here, it ships as data rather than as documentation a consumer
 * copies, and `dialOwnership()` derives the actual token names from the
 * stylesheets for any surface that wants the real list.
 *
 * @typedef {{name: string, attribute: string, values: string[],
 *            default: string, owns: string}} Dial
 * @type {Dial[]}
 */
export const DIALS = [
  {
    name: 'palette',
    attribute: 'data-palette',
    values: PALETTES,
    default: DEFAULT_PALETTE,
    owns: 'the brand — neutral hue and chroma, --signal-*, --anchor-*, --accent*, --link*, --focus-ring',
  },
  {
    name: 'theme',
    attribute: 'data-theme',
    values: THEMES,
    default: DEFAULT_THEME,
    owns: 'surfaces and text, and the re-picked value of everything the palette owns',
  },
  {
    name: 'platform',
    attribute: 'data-platform',
    values: PLATFORMS,
    default: DEFAULT_PLATFORM,
    owns: 'geometry only — radii, the small end of the type ramp, --gutter, the narrow containers. No colour.',
  },
];

/** A dial by name, or undefined. */
export function dialNamed(name) {
  return DIALS.find((dial) => dial.name === name);
}

/**
 * The root-element attributes that select one point on the three dials.
 *
 * A dial left at its default contributes nothing, because an absent attribute
 * already means the default — writing `data-theme="light"` is not wrong but it
 * is noise, and a bootstrap that writes it on first paint is a bootstrap that
 * can disagree with itself.
 *
 * @param {{palette?: string, theme?: string, platform?: string}} selection
 * @returns {Record<string, string>}
 */
export function dialAttributes(selection = {}) {
  const attributes = {};
  for (const dial of DIALS) {
    const value = selection[dial.name];
    if (value !== undefined && value !== null && value !== dial.default) {
      attributes[dial.attribute] = value;
    }
  }
  return attributes;
}

/**
 * `dialAttributes` as the string you would type into the markup — `''` for the
 * default selection, which is the honest answer and the one every surface
 * should print rather than inventing a placeholder.
 *
 * @param {{palette?: string, theme?: string, platform?: string}} selection
 * @returns {string}
 */
export function dialAttributeString(selection = {}) {
  return Object.entries(dialAttributes(selection))
    .map(([attribute, value]) => `${attribute}="${value}"`)
    .join(' ');
}

/** Every `[data-<dial>='<value>']` value a stylesheet actually declares tokens under. */
function declaredValues(css, attribute) {
  const pattern = new RegExp(`\\[${attribute}=['"]?([\\w-]+)['"]?\\]`, 'g');
  const found = new Set();
  for (const rule of tokenBlocks([css].flat())) {
    for (const [, value] of rule.selector.matchAll(pattern)) found.add(value);
  }
  return [...found].sort();
}

/**
 * The palettes the supplied stylesheets declare token blocks for.
 *
 * Pinned against `PALETTES` by dials.test.mjs in both directions: a
 * `[data-palette='forest']` block with no entry in the list, or an entry with
 * no block, is a half-added palette and half-added is the state every surface
 * here reports wrongly.
 *
 * @param {string | string[]} css
 */
export function declaredPalettes(css) {
  return declaredValues(css, 'data-palette');
}

/** The platforms the supplied stylesheets declare token blocks for. */
export function declaredPlatforms(css) {
  return declaredValues(css, 'data-platform');
}

/**
 * Every custom property one platform re-points, in declaration order.
 *
 * Reads any block whose selector carries `[data-platform='<platform>']` and
 * declares custom properties. mobile.css's `@media (max-width: 480px) and
 * (pointer: coarse)` twin is deliberately not read: `tokenBlocks` skips
 * at-rules whole, and the media block is the same values reached without
 * JavaScript rather than a second set. tokens.css's own
 * `:root[data-platform='mobile'] button, …` block declares no custom property
 * and so contributes nothing here — it raises control min-heights, which is
 * not a token.
 *
 * @param {string | string[]} css the platform stylesheet(s) — `readPlatformStylesheets()`
 * @param {string} platform
 * @returns {Array<{name: string, value: string}>}
 */
export function platformOverrides(css, platform = 'mobile') {
  if (css === null || css === undefined) return [];
  const pattern = new RegExp(`\\[data-platform=['"]?${platform}['"]?\\]`);
  const overrides = new Map();
  for (const rule of tokenBlocks([css].flat())) {
    if (!pattern.test(rule.selector)) continue;
    for (const [name, value] of rule.declarations) overrides.set(name, value);
  }
  return [...overrides].map(([name, value]) => ({ name, value }));
}

/**
 * Which tokens each dial moves, derived from the stylesheets rather than
 * listed. A family that migrates between layers reports itself.
 *
 * @param {string[]} sources the token stylesheets, in cascade order
 * @param {string | string[] | null} platformCss
 * @returns {Record<'palette' | 'theme' | 'platform', string[]>}
 */
export function dialOwnership(sources, platformCss = null) {
  const named = (attribute) => {
    const names = new Set();
    for (const rule of tokenBlocks(sources)) {
      if (!rule.selector.includes(attribute)) continue;
      for (const [name] of rule.declarations) names.add(name);
    }
    return [...names].sort();
  };

  return {
    palette: named('data-palette'),
    theme: named('data-theme'),
    platform: platformOverrides(platformCss).map(({ name }) => name),
  };
}

/**
 * Every token's value in every combination, plus the platform overrides.
 *
 * This is THE per-combination reader. `combinationValues` from contrast.mjs
 * does the resolving — the specificity ordering, the source ordering, the
 * `var()` chains, the one `calc()` the neutral ramp needs — and this walks it
 * across the roster. Nothing here re-implements any of that, because a second
 * resolver that disagrees with the first is worse than the single-combination
 * bug it replaced.
 *
 * `values` always has one entry per combination, in `COMBINATIONS` order, even
 * when they are all identical: a caller deciding how to print uses `varies`,
 * and a caller wanting one cell indexes it. `platforms` carries only the
 * platforms that actually override the token, so most tokens have none.
 *
 * Name order is the default combination's declaration order — what
 * `ds tokens` has always printed — with any name only a non-default
 * combination declares appended after it.
 *
 * @param {string[]} sources the token stylesheets, in cascade order
 * @param {{platformCss?: string | string[] | null}} [options]
 * @returns {Array<{name: string,
 *                  values: Array<{combination: string, palette: string, theme: string, value: string}>,
 *                  varies: boolean,
 *                  platforms: Array<{platform: string, value: string}>}>}
 */
export function tokenDials(sources, { platformCss = null } = {}) {
  const resolved = COMBINATIONS.map((combination) => ({
    combination,
    values: combinationValues(sources, combination),
  }));

  const defaultCombination = defaultCombinationId();
  const first =
    resolved.find((entry) => entry.combination.id === defaultCombination) ?? resolved[0];

  const names = [...first.values.keys()];
  const seen = new Set(names);
  for (const entry of resolved) {
    for (const name of entry.values.keys()) {
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }

  const overrides = new Map();
  for (const platform of PLATFORMS) {
    if (platform === DEFAULT_PLATFORM) continue;
    for (const { name, value } of platformOverrides(platformCss, platform)) {
      if (!overrides.has(name)) overrides.set(name, []);
      overrides.get(name).push({ platform, value });
    }
  }

  return names.map((name) => {
    const values = resolved.map(({ combination, values: map }) => ({
      combination: combination.id,
      palette: combination.palette,
      theme: combination.theme,
      value: map.get(name) ?? null,
    }));
    return {
      name,
      values,
      varies: new Set(values.map((entry) => entry.value)).size > 1,
      platforms: overrides.get(name) ?? [],
    };
  });
}

/** `<default palette>/<default theme>` — what a root element with no attributes renders. */
export function defaultCombinationId() {
  return `${DEFAULT_PALETTE}/${DEFAULT_THEME}`;
}

/** One entry's value in the default combination. */
export function defaultValueOf(entry) {
  return entry.values.find((value) => value.combination === defaultCombinationId())?.value ?? null;
}
