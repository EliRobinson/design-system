/* The contrast contract, as data.
 *
 * tokens.css declares a light palette on `:root` and overrides a subset of it
 * under `[data-theme='dark'], .dark`. A ratio is only meaningful per theme —
 * `--link-hover` is --signal-800 in one and --signal-400 in the other — so
 * everything here resolves a theme first and measures inside it.
 *
 * This is the module contrast.test.mjs asserts against. It is separate from
 * the test so the same resolution can be reused (the docs foundations pages
 * want it too) and so the test file reads as a list of thresholds rather than
 * as a CSS parser.
 */

import { contrastRatio } from './color.mjs';
import { effectiveTokens, parseTokensCss } from './parse-tokens-css.mjs';

/** The themes tokens.css defines, and the selector block each is declared in. */
export const THEMES = ['light', 'dark'];

/**
 * Custom properties declared in the dark-mode block.
 *
 * parseTokensCss deliberately reads `:root` only — everything outside it is
 * not a token declaration site. The dark block is the one exception that has
 * to be read as values, so it is scanned here rather than by widening the
 * parser and changing what every other consumer sees.
 *
 * @param {string} css
 * @returns {Map<string, string>}
 */
export function darkOverrides(css) {
  const block = css.match(/\[data-theme='dark'\],\s*\.dark\s*\{([\s\S]*?)\n\}/)?.[1];
  if (block === undefined) {
    throw new Error('tokens.css declares no [data-theme="dark"] block — has the selector moved?');
  }
  const masked = block.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Map([...masked.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/**
 * Every token's concrete value in one theme, `var()` chains followed.
 *
 * Dark mode re-points semantic tokens but never the base scales, so a chain
 * like `--link-hover: var(--signal-400)` has to resolve its head against the
 * dark overrides and its tail against `:root`. Resolving the raw declared
 * values here, rather than reusing the parser's light-mode `resolved`, is
 * what makes that come out right.
 *
 * @param {string} css
 * @param {'light' | 'dark'} theme
 * @returns {Map<string, string>}
 */
export function themeValues(css, theme) {
  const light = effectiveTokens(parseTokensCss(css));
  const declared = new Map([...light].map(([name, token]) => [name, token.value]));
  if (theme === 'dark') {
    for (const [name, value] of darkOverrides(css)) declared.set(name, value);
  }

  const MAX_DEPTH = 8;
  const resolve = (value, depth = 0) => {
    if (depth > MAX_DEPTH) return value;
    const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (!ref) return value;
    const target = declared.get(ref[1]);
    return target === undefined ? value : resolve(target, depth + 1);
  };

  return new Map([...declared].map(([name, value]) => [name, resolve(value)]));
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
      '--fg-on-signal': 'measured against --accent',
    },
  },
  {
    label: 'non-text',
    threshold: 3,
    criterion: 'SC 1.4.11',
    match: /^--(border-control|status-(success|warning|danger|info)$|focus-ring)/,
    except: {},
  },
];

/**
 * Run CONTRAST_RULES over a stylesheet.
 *
 * @param {string} css contents of tokens.css
 * @returns {Array<{theme: string, name: string, label: string, criterion: string,
 *                  threshold: number, value: string, ratio: number | null}>}
 */
export function measureTokens(css) {
  const results = [];
  for (const theme of THEMES) {
    const values = themeValues(css, theme);
    const bg = values.get('--bg');
    for (const rule of CONTRAST_RULES) {
      for (const [name, value] of values) {
        if (!rule.match.test(name) || name in rule.except) continue;
        results.push({
          theme,
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
