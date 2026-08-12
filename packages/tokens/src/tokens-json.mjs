/* Generates tokens.json from tokens.css.
 *
 * tokens.json used to be hand-maintained alongside the stylesheet and had
 * drifted: 95 leaf values against 151 `:root` custom properties, with
 * --signal-200/300/400/600/800/900 and --anchor-200/300/400/600/800/900 simply
 * missing and nothing in the file signalling it was partial. It is now derived,
 * and `tokens-json.test.mjs` fails if a single `:root` property is unaccounted
 * for.
 *
 * Why a table and not a naming convention
 * ---------------------------------------
 * Most of the nesting *is* mechanical, but three groups are not, and no honest
 * heuristic recovers them:
 *
 *   --fg-2 / --fg-3 / --fg-4  ->  fgSecondary / fgTertiary / fgDisabled
 *   --status-success          ->  color.semantic.success (prefix dropped)
 *   --anchor-500 vs --anchor-hover — same prefix, different groups
 *
 * So the mapping is explicit. GROUPS is matched in order; the first rule whose
 * pattern matches a token name owns it. A token that matches nothing is a hard
 * error naming the token, which is what makes "add a token to the CSS" a
 * one-line change here rather than a silent omission.
 */

import { effectiveTokens, parseTokensCss } from './parse-tokens-css.mjs';

/** `--accent-hover` -> `accentHover`, `--container-2xl` -> `container2xl`. */
function camel(name) {
  return name
    .replace(/^--/, '')
    .replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase())
    .replace(/-/g, '');
}

/** The part after a known prefix: `--fs-2xl` with prefix `fs` -> `2xl`. */
function suffix(name, prefix) {
  return name.slice(`--${prefix}-`.length);
}

/**
 * Every `:root` custom property, in the order it is declared in tokens.css,
 * mapped to its path in the generated JSON.
 *
 * `match` is tested against the full custom-property name. `path` returns the
 * object path the token's declared value is written to.
 */
const GROUPS = [
  // --- Color: base scales. Numeric suffix only, so --anchor-500 lands here
  // while --anchor-hover falls through to the semantic rules below. ---
  { match: /^--ink-\d+$/, path: (name) => ['color', 'ink', suffix(name, 'ink')] },
  { match: /^--signal-\d+$/, path: (name) => ['color', 'signal', suffix(name, 'signal')] },
  { match: /^--anchor-\d+$/, path: (name) => ['color', 'anchor', suffix(name, 'anchor')] },

  // --- Color: semantic. Keys that predate this generator are pinned by hand
  // because tokens-data consumers import them by name. ---
  {
    match: /^--status-(success|warning|danger|info)$/,
    path: (name) => semantic(suffix(name, 'status')),
  },
  { match: /^--fg-2$/, path: () => semantic('fgSecondary') },
  { match: /^--fg-3$/, path: () => semantic('fgTertiary') },
  { match: /^--fg-4$/, path: () => semantic('fgDisabled') },
  {
    match: /^--(bg|surface|border|fg|accent|anchor|link|focus-ring)(-[\w-]+)?$/,
    path: (name) => semantic(camel(name)),
  },

  // --- Type ---
  {
    match: /^--font-(sans|display|mono)$/,
    path: (name) => ['typography', 'fontStack', suffix(name, 'font')],
  },
  { match: /^--fs-/, path: (name) => ['typography', 'scale', suffix(name, 'fs')] },
  { match: /^--lh-/, path: (name) => ['typography', 'lineHeight', suffix(name, 'lh')] },
  { match: /^--tr-/, path: (name) => ['typography', 'tracking', suffix(name, 'tr')] },
  { match: /^--fw-/, path: (name) => ['typography', 'weight', suffix(name, 'fw')] },

  // --- Everything else ---
  { match: /^--space-/, path: (name) => ['space', suffix(name, 'space')] },
  { match: /^--radius-/, path: (name) => ['radius', suffix(name, 'radius')] },
  { match: /^--shadow-/, path: (name) => ['shadow', suffix(name, 'shadow')] },
  { match: /^--(ease|dur)-/, path: (name) => ['motion', camel(name)] },
  { match: /^--z-/, path: (name) => ['layout', 'z', suffix(name, 'z')] },
  { match: /^--(container-|gutter$)/, path: (name) => ['layout', camel(name)] },
];

function semantic(key) {
  return ['color', 'semantic', key];
}

/**
 * Where a custom property's value lands in tokens.json, or null if no rule in
 * GROUPS claims it.
 *
 * @param {string} name a custom-property name such as `--ink-500`
 * @returns {string[] | null}
 */
export function tokenPath(name) {
  const rule = GROUPS.find((candidate) => candidate.match.test(name));
  return rule ? rule.path(name) : null;
}

/**
 * Entries that are a *summary* of the stylesheet rather than a token in it.
 * Each one names the property it is read from, so a rename in tokens.css fails
 * the coverage test instead of silently freezing an old value.
 */
const DERIVED = [
  // brand.* is the resolved (var()-followed) value, so a reader gets a color.
  { path: ['brand', 'accent'], from: '--accent', read: (token) => token.resolved },
  { path: ['brand', 'anchor'], from: '--anchor', read: (token) => token.resolved },

  // The primary family out of each font stack — the first entry, unquoted.
  { path: ['typography', 'fontSans'], from: '--font-sans', read: primaryFamily },
  { path: ['typography', 'fontDisplay'], from: '--font-display', read: primaryFamily },
  { path: ['typography', 'fontMono'], from: '--font-mono', read: primaryFamily },

  { path: ['typography', 'baseSize'], from: '--fs-md', read: (token) => token.value },
];

/* The first entry of a font stack, unquoted. Read from `resolved`, not
   `value` — the family tokens are declared as
   `var(--ds-font-sans-override, 'Geist', …)` so a consumer can re-point them,
   and the summary wants the family a reader gets by default, not the hook. */
function primaryFamily(token) {
  return token.resolved
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function at(target, path) {
  return path.reduce((node, key) => node?.[key], target);
}

function assign(target, path, value) {
  let node = target;
  for (const key of path.slice(0, -1)) {
    node[key] ??= {};
    node = node[key];
  }
  node[path.at(-1)] = value;
}

/**
 * Build the tokens.json object from a tokens stylesheet.
 *
 * @param {string} css contents of tokens.css
 * @returns {Record<string, unknown>}
 */
export function buildTokensJson(css) {
  const parsed = parseTokensCss(css);
  if (parsed.length === 0) {
    throw new Error('No :root custom properties found — is this tokens.css?');
  }

  // Last declaration wins, as in CSS.
  const effective = effectiveTokens(parsed);
  const result = {};

  const unmapped = [];
  for (const [name, token] of effective) {
    const path = tokenPath(name);
    if (!path) {
      unmapped.push(name);
      continue;
    }
    assign(result, path, token.value);
  }

  if (unmapped.length > 0) {
    throw new Error(
      `tokens.css declares ${unmapped.length} custom ${
        unmapped.length === 1 ? 'property' : 'properties'
      } that no rule in GROUPS claims: ${unmapped.join(', ')}.\n` +
        'Add a rule to packages/tokens/src/tokens-json.mjs so the token reaches tokens.json.',
    );
  }

  for (const { path, from, read } of DERIVED) {
    const token = effective.get(from);
    if (!token) {
      throw new Error(
        `tokens.json derives ${path.join('.')} from ${from}, which tokens.css no longer declares.`,
      );
    }
    if (at(result, path) !== undefined) {
      throw new Error(
        `The derived entry ${path.join('.')} would overwrite a token GROUPS already mapped there.`,
      );
    }
    assign(result, path, read(token));
  }

  return withTopLevelOrder(result);
}

/* Keys come out in Map insertion order, which is source order in tokens.css,
   except for the DERIVED entries appended last. Re-order the top level so the
   file reads brand-first the way the hand-written one did. */
const TOP_LEVEL_ORDER = [
  'brand',
  'color',
  'typography',
  'radius',
  'space',
  'shadow',
  'motion',
  'layout',
];

function withTopLevelOrder(result) {
  /* A new top-level group would otherwise sort to the front on indexOf's -1 —
     quietly, which is the one thing this file is not allowed to do. */
  const unordered = Object.keys(result).filter((key) => !TOP_LEVEL_ORDER.includes(key));
  if (unordered.length > 0) {
    throw new Error(
      `GROUPS produced top-level ${unordered.length === 1 ? 'group' : 'groups'} ` +
        `${unordered.join(', ')} that TOP_LEVEL_ORDER does not rank.`,
    );
  }

  return Object.fromEntries(
    Object.keys(result)
      .sort((a, b) => TOP_LEVEL_ORDER.indexOf(a) - TOP_LEVEL_ORDER.indexOf(b))
      .map((key) => [key, result[key]]),
  );
}

/** The exact bytes packages/tokens/src/tokens.json should contain. */
export function serializeTokensJson(css) {
  return `${JSON.stringify(buildTokensJson(css), null, 2)}\n`;
}
