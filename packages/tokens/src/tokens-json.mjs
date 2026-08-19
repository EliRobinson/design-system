/* Generates tokens.json from the token stylesheets.
 *
 * tokens.json used to be hand-maintained alongside the stylesheet and had
 * drifted: 95 leaf values against the 151 `:root` custom properties there were
 * then, with --signal-200/300/400/600/800/900 and
 * --anchor-200/300/400/600/800/900 simply missing and nothing in the file
 * signalling it was partial. It is derived now — 196 `:root` properties, 202
 * leaves once the six DERIVED summaries are added — and `tokens-json.test.mjs`
 * fails if a single one is unaccounted for.
 *
 * Feed it EVERY token stylesheet, not just tokens.css. The palette split moved
 * --accent*, --anchor*, --link*, --focus-ring and the status and chart families
 * into palettes.css, which tokens.css @imports; hand this tokens.css alone and
 * 71 of the 196 properties are simply not there, which the DERIVED check below
 * catches by name rather than letting a brandless tokens.json onto disk.
 * `readTokenStylesheets()` in ./token-stylesheets.mjs is the roster, already in
 * cascade order.
 *
 * Why a table and not a naming convention
 * ---------------------------------------
 * Most of the nesting *is* mechanical, but four groups are not, and no honest
 * heuristic recovers them:
 *
 *   --fg-2 / --fg-3 / --fg-4  ->  fgSecondary / fgTertiary / fgDisabled
 *   --fg-disabled             ->  fgDisabledText (fgDisabled is --fg-4's)
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
 * Every `:root` custom property, in the order the stylesheets declare them —
 * palettes.css first, then tokens.css — mapped to its path in the generated
 * JSON.
 *
 * `match` is tested against the full custom-property name. `path` returns the
 * object path the token's declared value is written to.
 */
const GROUPS = [
  /* --- Color: the two neutral dials. Not a scale and not a colour — they are
     the hue and the chroma multiplier every --ink-* step is mixed from, so a
     reader of tokens.json can see why one palette's greys are near-achromatic
     and another's are charcoal. Their own group rather than a leaf under
     color.ink, because color.ink.* is a ramp of colours and these are not. --- */
  { match: /^--n-(h|mult)$/, path: (name) => ['color', 'neutral', suffix(name, 'n')] },

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
  /* The rest of each status set: --status-danger-fg -> semantic.dangerFg,
     --status-danger-tint -> semantic.dangerTint, --status-danger-on ->
     semantic.dangerOn, --status-success-tint-edge -> semantic.successTintEdge.
     Same dropped `status` prefix as the fills above, so every member of a set
     reads together. -fg and -tint predate this rule's other members and are
     published keys; the alternation only ever grows.

     `tint-edge` is written before `tint` for the reader's benefit — the `$`
     anchor already forces the backtrack — because a member list that reads in
     the same order as the table in palettes.css is one fewer thing to check. */
  {
    match: /^--status-(success|warning|danger|info)-(fg|tint-edge|tint|on|border)$/,
    path: (name) => semantic(camel(`--${suffix(name, 'status')}`)),
  },
  { match: /^--fg-2$/, path: () => semantic('fgSecondary') },
  { match: /^--fg-3$/, path: () => semantic('fgTertiary') },
  { match: /^--fg-4$/, path: () => semantic('fgDisabled') },
  /* --fg-4 claimed `fgDisabled` before --fg-disabled existed, and that key is
     published API. --fg-4 is documented decorative-only now and --fg-disabled
     is the accessible disabled-control text, so the new token takes its own
     leaf rather than displacing a key consumers already import. */
  { match: /^--fg-disabled$/, path: () => semantic('fgDisabledText') },
  /* --scrim joins the sweep rather than getting its own rule: it is a semantic
     colour like the rest, it just has no family to be a member of. */
  {
    match: /^--(bg|surface|border|fg|accent|anchor|link|focus-ring|scrim)(-[\w-]+)?$/,
    path: (name) => semantic(camel(name)),
  },

  /* --- Color: the categorical chart ramp. color.chart.1 … .8 plus .grid and
     .axis, which are the two chart colours that are not a series. Kept out of
     color.semantic because a consumer picking a series colour iterates the
     eight, and a semantic bag with eight numbered members in it is not
     iterable without knowing which members to skip. --- */
  { match: /^--chart-/, path: (name) => ['color', 'chart', suffix(name, 'chart')] },

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
  /* Widths, gutters, hit areas and safe-area insets. Targets and insets are
     layout and not color.semantic despite naming a control: --target is a
     length a component reads for min-height, exactly as --gutter is one it
     reads for padding. */
  {
    match: /^--(container-|gutter$|target$|target-|safe-)/,
    path: (name) => ['layout', camel(name)],
  },
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
 * Build the tokens.json object from the token stylesheets.
 *
 * @param {string | string[]} css one stylesheet, or several in cascade order —
 *   `readTokenStylesheets()` from ./token-stylesheets.mjs returns exactly that.
 *   It is forwarded to `parseTokensCss`, which concatenates the declarations in
 *   the order given so last-wins still means what CSS means by it.
 * @returns {Record<string, unknown>}
 */
export function buildTokensJson(css) {
  const parsed = parseTokensCss(css);
  if (parsed.length === 0) {
    throw new Error('No :root custom properties found — are these the token stylesheets?');
  }

  // Last declaration wins, as in CSS.
  const effective = effectiveTokens(parsed);
  const count = Array.isArray(css) ? css.length : 1;
  const sources = count === 1 ? 'stylesheet' : `${count} stylesheets`;
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
      `The token stylesheets declare ${unmapped.length} custom ${
        unmapped.length === 1 ? 'property' : 'properties'
      } that no rule in GROUPS claims: ${unmapped.join(', ')}.\n` +
        'Add a rule to packages/tokens/src/tokens-json.mjs so the token reaches tokens.json.',
    );
  }

  for (const { path, from, read } of DERIVED) {
    const token = effective.get(from);
    if (!token) {
      /* Two different faults land here and they want different fixes, so name
         both. The token really was renamed or deleted — or, far more likely on
         a first run after the palette split, the caller passed tokens.css on
         its own and the brand sources (--accent, --anchor) are in palettes.css
         where this cannot see them. */
      throw new Error(
        `tokens.json derives ${path.join('.')} from ${from}, which the ${sources} ` +
          'passed to buildTokensJson does not declare. Either the token was renamed, ' +
          'or not every token stylesheet was passed — pass readTokenStylesheets() from ' +
          'packages/tokens/src/token-stylesheets.mjs, which lists them in cascade order.',
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

/**
 * The exact bytes packages/tokens/src/tokens.json should contain.
 *
 * @param {string | string[]} css one stylesheet, or several in cascade order
 * @returns {string}
 */
export function serializeTokensJson(css) {
  return `${JSON.stringify(buildTokensJson(css), null, 2)}\n`;
}
