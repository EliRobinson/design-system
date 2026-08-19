/* The contrast contract, as data.
 *
 * The token vocabulary is spread across two stylesheets and resolves under two
 * independent attributes: palettes.css declares the brand under
 * `data-palette`, and both files re-pick values under `data-theme`. A ratio is
 * only meaningful inside one COMBINATION of the two — `--accent` is amber at
 * 2.53:1 in ember and teal at 5.11:1 in slate, and `--link-hover` is a
 * different ramp step in each of the four — so everything here resolves a
 * combination first and measures inside it.
 *
 * This used to hard-code the single `[data-theme='dark'], .dark` block of a
 * single file. That was enough while there was one brand, and it is exactly
 * what let two un-inverted tints ship: a per-token sweep of two themes cannot
 * see a value that is only wrong under a third dial.
 *
 * This is the module contrast.test.mjs asserts against. It is separate from
 * the test so the same resolution can be reused (the docs foundations pages
 * want it too) and so the test file reads as a list of thresholds rather than
 * as a CSS parser.
 */

import { contrastRatio } from './color.mjs';

/** The palettes palettes.css defines. */
export const PALETTES = ['ember', 'slate', 'miltinson'];

/** The themes the system defines. */
export const THEMES = ['light', 'dark'];

/**
 * Every combination of the two dials, as `{palette, theme, id}`. `id` is what
 * a test name says, so a failure names the combination and not just the theme.
 */
export const COMBINATIONS = PALETTES.flatMap((palette) =>
  THEMES.map((theme) => ({ palette, theme, id: `${palette}/${theme}` })),
);

/** The palette that `:root` alone declares — the one with no attribute set. */
export const DEFAULT_PALETTE = PALETTES[0];

/**
 * Every top-level rule of a stylesheet, as `{selector, body, order}`.
 *
 * Hand-scanned on brace depth rather than regexed: tokens.css contains a
 * `@media (prefers-reduced-motion: reduce)` block with rules nested inside it,
 * and a flat `([^{}]+)\{([^{}]*)\}` sweep reads those nested rules as top-level
 * ones. At-rules are skipped whole — nothing inside one declares a default
 * token value, and mobile.css (which is where the media-query token block
 * lives) is deliberately not read here at all.
 *
 * Every comment is blanked first, offsets preserved. tokens.css documents the
 * font-override hook with a worked `:root { … }` snippet written inside a
 * comment; scanned raw, that snippet is the first brace in the file and the
 * real `:root` is never seen — the whole neutral ramp goes missing and every
 * ratio below it reports null.
 *
 * @param {string} raw
 * @param {number} file index of the stylesheet in cascade order
 */
function topLevelRules(raw, file) {
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const rules = [];
  let index = 0;
  let selectorStart = 0;

  while (index < css.length) {
    const open = css.indexOf('{', index);
    if (open === -1) break;

    /* Everything since the last `}` or `;` at depth 0. The `;` matters: the
       @import rules at the top of tokens.css are statements, not blocks, so
       without it the first selector reads as "…@import './palettes.css'; …
       :root", which starts with `@` and gets skipped as an at-rule — and the
       neutral ramp silently never lands. */
    const preamble = css.slice(selectorStart, open);
    const selector = preamble.slice(preamble.lastIndexOf(';') + 1).trim();
    let depth = 0;
    let close = open;
    for (; close < css.length; close += 1) {
      if (css[close] === '{') depth += 1;
      else if (css[close] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (close >= css.length) break;

    if (!selector.startsWith('@')) {
      rules.push({
        selector: selector.replace(/\s+/g, ' '),
        body: css.slice(open + 1, close),
        file,
        order: rules.length,
      });
    }
    index = close + 1;
    selectorStart = index;
  }
  return rules;
}

/* The simple selectors a token block is allowed to be built from, and what
   each one asserts about the two dials. Anything else means a block this
   module does not understand, which `assertUnderstood` turns into a failure
   rather than a silent omission — a `[data-palette='forest']` block added
   without a line here would go unmeasured, which is precisely the class of
   miss this file exists to close. */
const SELECTOR_PARTS = [
  { pattern: /^:root$/, applies: () => true },
  { pattern: /^\.dark$/, applies: (combination) => combination.theme === 'dark' },
  {
    pattern: /^\[data-theme='(\w+)'\]$/,
    applies: (combination, match) => combination.theme === match[1],
  },
  {
    pattern: /^\[data-palette='([\w-]+)'\]$/,
    applies: (combination, match) => combination.palette === match[1],
  },
];

/** Split a compound selector into its simple parts: `:root[data-x='y']`. */
function compoundParts(compound) {
  return compound.match(/(?::root|\.[\w-]+|\[[^\]]+\])/g) ?? [];
}

/**
 * The specificity a selector list contributes under one combination, or null
 * if none of its comma-separated selectors applies.
 *
 * Only the class-level column is counted, because every selector in these
 * stylesheets lives entirely in it — `:root`, `.dark` and `[data-*]` are all
 * (0,1,0) each. So `[data-palette='slate'][data-theme='dark']` is 2 and the
 * three single-condition blocks are 1, which is the whole ordering.
 */
function specificity(selectorList, combination) {
  let best = null;
  for (const compound of selectorList.split(',')) {
    const parts = compoundParts(compound.trim());
    if (parts.length === 0) continue;
    let applies = true;
    for (const part of parts) {
      const rule = SELECTOR_PARTS.find((candidate) => candidate.pattern.test(part));
      if (!rule || !rule.applies(combination, part.match(rule.pattern))) {
        applies = false;
        break;
      }
    }
    if (applies) best = Math.max(best ?? 0, parts.length);
  }
  return best;
}

/** Custom-property declarations of one rule body, comments masked out. */
function declarations(body) {
  const masked = body.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...masked.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
    match[1],
    match[2].replace(/\s+/g, ' ').trim(),
  ]);
}

/**
 * Every rule in the token stylesheets that declares a custom property.
 *
 * @param {string[]} sources stylesheets in cascade order
 */
function tokenBlocks(sources) {
  return sources
    .flatMap((css, file) => topLevelRules(css, file))
    .map((rule) => ({ ...rule, declarations: declarations(rule.body) }))
    .filter((rule) => rule.declarations.length > 0);
}

/**
 * Fail on a block whose selector this module cannot read.
 *
 * A stylesheet may grow a block — a third palette, a high-contrast mode —
 * whose declarations no combination here would ever resolve. Left unchecked
 * that block is simply never measured, and the tokens in it ship unmeasured.
 *
 * @param {string[]} sources
 * @returns {string[]} the selectors that no combination understands
 */
export function unreadableSelectors(sources) {
  return tokenBlocks(sources)
    .filter((rule) =>
      rule.selector
        .split(',')
        .every((compound) =>
          compoundParts(compound.trim()).some(
            (part) => !SELECTOR_PARTS.some((candidate) => candidate.pattern.test(part)),
          ),
        ),
    )
    .map((rule) => rule.selector);
}

/**
 * Every token's concrete value in one palette × theme, `var()` chains followed.
 *
 * Blocks are applied in the order a browser would: by specificity first, then
 * by source order within the cascade — which is @imported files before the
 * file that imports them. That ordering is the only thing standing between
 * `[data-palette='slate']` (block 3) and the ember dark block (block 2), and
 * it is why slate's dark block has to restate the whole set rather than diff
 * block 2. See the header of palettes.css.
 *
 * @param {string[]} sources stylesheets in cascade order
 * @param {{palette: string, theme: string}} combination
 * @returns {Map<string, string>}
 */
export function combinationValues(sources, combination) {
  const applicable = tokenBlocks(sources)
    .map((rule) => ({ ...rule, weight: specificity(rule.selector, combination) }))
    .filter((rule) => rule.weight !== null)
    .sort((a, b) => a.weight - b.weight || a.file - b.file || a.order - b.order);

  const declared = new Map();
  for (const rule of applicable) {
    for (const [name, value] of rule.declarations) declared.set(name, value);
  }

  const MAX_DEPTH = 8;
  const resolve = (value, depth = 0) => {
    if (depth > MAX_DEPTH) return value;
    /* A bare reference resolves to its target. A value that merely *contains*
       one — `oklch(62% calc(0.008 * var(--n-mult)) var(--n-h))` — is
       substituted in place, which is what turns the neutral ramp into a
       measurable colour instead of an unparseable string. */
    const bare = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (bare) {
      const target = declared.get(bare[1]);
      return target === undefined ? value : resolve(target, depth + 1);
    }
    if (!value.includes('var(')) return value;
    const substituted = value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (whole, name) => {
      const target = declared.get(name);
      return target === undefined ? whole : target;
    });
    return substituted === value ? value : resolve(substituted, depth + 1);
  };

  return new Map([...declared].map(([name, value]) => [name, flattenCalc(resolve(value))]));
}

/* `oklch(62% calc(0.008 * 1.6) 252)` is what the neutral ramp resolves to once
   the dials are substituted, and color.mjs parses numbers, not expressions.
   Only the one form the ramp uses is evaluated — a multiplication of two
   literals — so this cannot quietly become a general calc() engine that
   disagrees with a browser about anything more interesting. */
function flattenCalc(value) {
  return value.replace(
    /calc\(\s*([\d.]+)\s*\*\s*([\d.]+)\s*\)/g,
    (_, a, b) => `${Number((Number(a) * Number(b)).toFixed(6))}`,
  );
}

/**
 * The values of one theme under the default palette.
 *
 * Kept because a reader outside this file usually means "the shipped brand in
 * dark mode", and spelling `{palette: 'ember', theme}` at every call site is
 * how the default silently becomes a second opinion.
 *
 * @param {string | string[]} sources
 * @param {'light' | 'dark'} theme
 */
export function themeValues(sources, theme) {
  return combinationValues(Array.isArray(sources) ? sources : [sources], {
    palette: DEFAULT_PALETTE,
    theme,
  });
}

/**
 * Which tokens must clear which threshold against `--bg`, and why.
 *
 * `match` is tested against the custom-property name. The thresholds are the
 * WCAG 2.2 AA numbers: 4.5:1 for body text (SC 1.4.3) and 3:1 for a control
 * boundary or other meaningful non-text graphic (SC 1.4.11).
 *
 * `except` names the tokens deliberately outside a rule, each with the reason
 * it is exempt. An exemption is a claim that the token never carries meaning,
 * and adding one is the decision this whole file exists to make deliberate.
 */
export const CONTRAST_RULES = [
  {
    label: 'text',
    threshold: 4.5,
    criterion: 'SC 1.4.3',
    match: /^--(fg|link|accent-ink$|anchor-ink$|status-(success|warning|danger|info)-fg$)/,
    except: {
      /* Decorative greys. They are not exempt from AA because they are hard to
         fix — they are exempt because nothing they paint carries information:
         --fg-4 is the dimmed non-informational grey (a comparison series on a
         chart, a placeholder glyph), and text that has to be read uses
         --fg-disabled. See docs/agents/tokens.md. */
      '--fg-4': 'decorative / non-informational grey, never a label — 2.67:1',
      /* Not a color. `currentColor` inherits whatever filled surface it lands
         on, which is the entire point of the token. */
      '--link-on-fill': 'resolves to currentColor, measured at the fill',
      /* Inverse pairs are measured against --bg-inverse, not --bg; they are
         covered by the inverse-pair assertions in contrast.test.mjs. */
      '--fg-inverse': 'measured against --bg-inverse',
      '--fg-inverse-2': 'measured against --bg-inverse',
      '--fg-inverse-3': 'measured against --bg-inverse',
      '--fg-on-signal': 'measured against --accent',
    },
  },
  {
    label: 'non-text',
    threshold: 3,
    criterion: 'SC 1.4.11',
    match:
      /^--(border-control|status-(success|warning|danger|info)$|status-warning-border$|focus-ring|chart-)/,
    except: {
      /* The documented exception, and the only one in the status family.
         Yellow cannot reach 3:1 on white and still read as yellow — pushed
         dark enough to clear the floor it is olive, which is not a caution
         colour. So --status-warning is 1.87:1 and is never drawn bare: a
         warning fill or rule is edged with --status-warning-border, which is
         3.76:1 light / 11.22:1 dark and IS measured by this rule. Toast's
         warning stripe is the worked example. Removing this exemption means
         changing the colour, not quieting the test. */
      '--status-warning':
        'yellow cannot clear 3:1 on white and stay yellow — 1.87:1, and must be ' +
        'edged with --status-warning-border, which carries the SC 1.4.11 floor',
      /* Plot furniture, in the same category as --border and --border-strong:
         a gridline the reader cannot see costs them nothing, because the axis
         and the series carry the reading. --chart-axis is the line that does
         carry meaning, and it is measured. */
      '--chart-grid': 'decorative gridline, the --border-strong of a plot — 1.53:1',
    },
  },
];

/**
 * Run CONTRAST_RULES over the token stylesheets, in every palette × theme.
 *
 * @param {string[]} sources stylesheets in cascade order
 * @returns {Array<{palette: string, theme: string, combination: string, name: string,
 *                  label: string, criterion: string, threshold: number,
 *                  value: string, ratio: number | null}>}
 */
export function measureTokens(sources) {
  const results = [];
  for (const combination of COMBINATIONS) {
    const values = combinationValues(sources, combination);
    const bg = values.get('--bg');
    for (const rule of CONTRAST_RULES) {
      for (const [name, value] of values) {
        if (!rule.match.test(name) || name in rule.except) continue;
        results.push({
          palette: combination.palette,
          theme: combination.theme,
          combination: combination.id,
          name,
          label: rule.label,
          criterion: rule.criterion,
          threshold: rule.threshold,
          value,
          ratio: contrastRatio(value, bg),
        });
      }
    }
  }
  return results;
}
