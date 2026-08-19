/* The reported bug, end to end.
 *
 * component-css.test.mjs asserts the *mechanism* — that every filled variant
 * carries a `color` declaration in each state. This file asserts the
 * *outcome*: resolve the cascade over the real shipped stylesheets and measure
 * what an `<a class="ds-button ds-button--VARIANT">` label actually renders
 * as, resting, hovered and pressed, in every palette and theme.
 *
 * Those are two different claims. A `color` declaration that loses the cascade
 * satisfies the first and not the second, and losing the cascade is exactly
 * what happened: tokens.css's `a:hover` (0,1,1) beat `.ds-button--accent`
 * (0,1,0), and the label came out amber on amber at 2.31:1.
 *
 * `--accent` is the variant that was reported, and it is the mildest case, not
 * the worst. `--link-hover` is amber and `.ds-button--primary:hover` fills
 * with `--fg-2`, so the same lost cascade there is amber on near-black:
 * 1.15:1 light, 1.35:1 dark. Every variant is measured for that reason — a
 * mechanism test tells you a `color` declaration exists, not that it wins the
 * cascade or that what it paints is legible on the fill underneath it.
 *
 * Selectors are parsed and matched by jsdom's own CSSOM and selector engine.
 * Specificity comes from ./specificity.mjs — there is no DOM API that exposes
 * it — so the two specificities the bug turned on are pinned as their own
 * assertions below, where the arithmetic is checkable rather than assumed.
 *
 * ---------------------------------------------------------------------------
 * Why nothing here reads tokens.css by name
 * ---------------------------------------------------------------------------
 * This file used to open tokens.css, run its own `:root` and
 * `[data-theme='dark'], .dark` regexes over the text, and inject that one
 * string into jsdom. Every part of that broke on the palette split, and none
 * of it broke loudly:
 *
 *   - `--accent`, `--accent-hover`, `--accent-press` and `--link-hover` moved
 *     to palettes.css. A hand-rolled read of tokens.css still parses and
 *     simply returns `undefined` for each of them.
 *   - jsdom does NOT follow `@import`, so injecting tokens.css alone gives a
 *     document whose stylesheet declares no brand at all.
 *   - a per-theme regex cannot see `[data-palette='slate']`, and slate is
 *     where a hardcoded hover DIRECTION would show up: ember lightens 500→400
 *     on hover, slate darkens 600→700 in light and 300→400 in dark.
 *
 * So the roster comes from `@elirobinson/tokens/token-stylesheets`, the values
 * come from contrast.mjs's `combinationValues` — the same resolver
 * packages/tokens' own contrast.test.mjs measures against, which knows the
 * four-block cascade including the (0,2,0) slate-dark block — and the
 * stylesheet handed to jsdom is every source concatenated in cascade order, so
 * the `@import` jsdom will not follow is already flattened.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contrastRatio } from '@elirobinson/tokens/color';
/* The same resolver packages/tokens measures itself with, reached through its
   exports map. A second implementation of "what does this token resolve to
   under this palette and theme" is how the gate and the thing it gates come
   to disagree. */
import { COMBINATIONS, combinationValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { beforeAll, describe, expect, it } from 'vitest';

import { compareCascade as compare, specificity, styleRules } from './specificity.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

const TOKEN_SOURCES = readTokenStylesheets();
const BUTTON_CSS = read('src', 'components', 'atoms', 'Button.css');

/**
 * The `color` an element renders in a given pseudo-state, resolved over every
 * loaded stylesheet: last declaration wins among equally specific rules.
 *
 * A rule applies in `state` when the element matches it with that pseudo-class
 * removed — the substitution a browser makes when the pointer is over it.
 */
function resolveColor(element, state) {
  let winner = null;
  let winning = { layered: true, specificity: [-1, -1, -1] };

  for (const { rule, layered } of styleRules(document.styleSheets)) {
    if (!rule.style?.color) continue;
    for (const part of rule.selectorText.split(',')) {
      const selector = part.trim();
      const withoutState = state === null ? selector : selector.replaceAll(`:${state}`, '');
      // A rule gated on a state the element is not in never applies.
      if (/:(hover|active|focus-visible|focus|disabled)\b/.test(withoutState)) continue;
      if (!element.matches(withoutState)) continue;

      const candidate = { layered, specificity: specificity(selector) };
      if (compare(candidate, winning) >= 0) {
        winning = candidate;
        winner = { selector, layered, color: rule.style.color };
      }
    }
  }
  return winner;
}

/**
 * Follow a `var()` chain to a concrete colour, inside one palette × theme.
 *
 * jsdom exposes custom properties on neither getComputedStyle nor
 * CSSStyleDeclaration, so the resolved token map is the only place these
 * values exist in this test.
 */
function resolveVar(value, values) {
  const reference = value.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return reference ? values.get(reference[1]) : value.trim();
}

const STATES = [
  [null, 'resting'],
  ['hover', 'hovered'],
  ['active', 'pressed'],
];

/* Every variant, and the token that paints what sits behind its label in each
   state — so the label is measured against what is actually under it rather
   than against the page background. `--secondary` and `--ghost` paint no fill
   of their own when resting, so the page shows through and `--bg` is right.

   The fills are NAMED, never assumed to be a direction on the ramp. That is
   what makes this table survive a second palette: ember's accent lightens on
   hover (500 -> 400) and slate's darkens (600 -> 700 in light, 300 -> 400 in
   dark), and a component reads `--accent-hover` either way.

   `threshold` is 4.5 (SC 1.4.3) everywhere but disabled: SC 1.4.3 excludes
   text that is part of an inactive user interface component, and
   `--fg-disabled` on `--bg-muted` measures 4.34:1 light / 7.60:1 dark. It is
   held to the 3:1 non-text floor rather than exempted outright, because a
   disabled label a user cannot see at all is still a defect. */
const VARIANTS = [
  {
    modifier: 'primary',
    threshold: 4.5,
    fills: { resting: '--fg', hovered: '--fg-2', pressed: '--fg' },
  },
  {
    modifier: 'accent',
    threshold: 4.5,
    fills: { resting: '--accent', hovered: '--accent-hover', pressed: '--accent-press' },
  },
  {
    modifier: 'secondary',
    threshold: 4.5,
    fills: { resting: '--bg', hovered: '--bg-subtle', pressed: '--bg-muted' },
  },
  {
    modifier: 'ghost',
    threshold: 4.5,
    fills: { resting: '--bg', hovered: '--bg-subtle', pressed: '--bg-muted' },
  },
  {
    modifier: 'disabled',
    threshold: 3,
    fills: { resting: '--bg-muted', hovered: '--bg-muted', pressed: '--bg-muted' },
  },
];

describe('every <a class="ds-button ds-button--*"> label clears its threshold', () => {
  /** One live anchor per `${modifier}:${combination}`, all in the same document. */
  const anchors = new Map();
  /** The resolved token values per palette × theme, keyed by combination id. */
  const tokens = new Map(COMBINATIONS.map((c) => [c.id, combinationValues(TOKEN_SOURCES, c)]));

  beforeAll(() => {
    const style = document.createElement('style');
    /* Cascade order, flattened: palettes.css then tokens.css then the
       component. tokens.css's `@import './palettes.css'` is left where it is
       and is inert — jsdom parses it as a CSSImportRule and never fetches it,
       which is the whole reason the sources are concatenated here. */
    style.textContent = [...TOKEN_SOURCES, BUTTON_CSS].join('\n');
    document.head.appendChild(style);

    for (const { palette, theme, id } of COMBINATIONS) {
      const host = document.createElement('div');
      /* The dials as a consumer sets them. Both are inherited attributes in
         the selector sense — palettes.css's blocks are `[data-palette='…']`
         and `[data-theme='dark']`, not `:root`-only — so a host div is a
         faithful stand-in for the documented mounting point. */
      if (palette !== 'ember') host.setAttribute('data-palette', palette);
      if (theme === 'dark') host.setAttribute('data-theme', 'dark');
      for (const { modifier } of VARIANTS) {
        const anchor = document.createElement('a');
        anchor.className = `ds-button ds-button--${modifier}`;
        anchor.href = '#';
        anchor.textContent = 'Read the guide';
        host.appendChild(anchor);
        anchors.set(`${modifier}:${id}`, anchor);
      }
      document.body.appendChild(host);
    }
  });

  it('loaded the real stylesheets, not an empty document', () => {
    const selectors = [...styleRules(document.styleSheets)].map(({ rule }) => rule.selectorText);
    expect(selectors).toContain('a:hover'); // tokens.css
    for (const { modifier } of VARIANTS) {
      expect(selectors.join('\n')).toContain(`.ds-button--${modifier}:hover`); // Button.css
    }
    // palettes.css — the file jsdom would have silently skipped over the
    // `@import`, taking the entire brand with it.
    expect(selectors).toContain("[data-palette='slate']");
  });

  it('pins the specificities the bug turned on', () => {
    // (0,1,1) beats (0,1,0) — this is why the element rule won.
    expect(specificity('a:hover')).toEqual([0, 1, 1]);
    expect(specificity('.ds-button--accent')).toEqual([0, 1, 0]);
    // (0,2,0) beats (0,1,1) — this is the fix.
    expect(specificity('.ds-button--accent:hover')).toEqual([0, 2, 0]);
    // And since issue #112 there is a second, stronger one behind it: the `a`
    // rules moved into `@layer base`, and an unlayered declaration outranks a
    // layered one whatever the specificity. `resolveColor` models that — see
    // `compareCascade` — so this file would still be measuring the right
    // winner if the (0,2,0) restatements above were ever removed.
  });

  it('resolved a brand for every palette and theme', () => {
    // Reading tokens.css alone leaves all four of these undefined, and every
    // ratio below would then report null rather than fail on a number.
    for (const { id } of COMBINATIONS) {
      for (const name of ['--accent', '--accent-hover', '--accent-press', '--accent-fg']) {
        expect(tokens.get(id).get(name), `${name} in ${id}`).toMatch(/^(#|oklch|rgb)/);
      }
    }
  });

  for (const { modifier, threshold, fills } of VARIANTS) {
    for (const { id } of COMBINATIONS) {
      for (const [state, label] of STATES) {
        it(`--${modifier}, ${id}, ${label} >= ${threshold}:1`, () => {
          const values = tokens.get(id);
          const winner = resolveColor(anchors.get(`${modifier}:${id}`), state);
          expect(winner, `nothing set a color for --${modifier} ${label}`).not.toBeNull();

          const foreground = resolveVar(winner.color, values);
          const background = values.get(fills[label]);
          const measured = contrastRatio(foreground, background);

          expect(
            measured,
            `${winner.selector} gives ${foreground} on ${background}`,
          ).not.toBeNull();
          expect(
            Number(measured.toFixed(2)),
            `${winner.selector} wins the cascade and puts ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(threshold);
        });
      }
    }
  }

  it('is won by the variant, not by the global a:hover', () => {
    for (const { modifier } of VARIANTS) {
      for (const { id } of COMBINATIONS) {
        const winner = resolveColor(anchors.get(`${modifier}:${id}`), 'hover');
        expect(winner.selector, `--${modifier} ${id} hover`).not.toBe('a:hover');
        expect(winner.color, `--${modifier} ${id} hover`).not.toBe('var(--link-hover)');
      }
    }
  });
});
