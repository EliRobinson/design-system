/* The reported bug, end to end.
 *
 * component-css.test.mjs asserts the *mechanism* — that every filled variant
 * carries a `color` declaration in each state. This file asserts the
 * *outcome*: resolve the cascade over the real shipped stylesheets and measure
 * what an `<a class="ds-button ds-button--VARIANT">` label actually renders
 * as, resting, hovered and pressed, in both themes.
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
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contrastRatio } from '@elirobinson/tokens/color';
import { beforeAll, describe, expect, it } from 'vitest';

import { compareSpecificity as compare, specificity } from './specificity.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

const TOKENS_CSS = readFileSync(join(here, '..', '..', 'tokens', 'src', 'tokens.css'), 'utf8');
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
  let winningSpecificity = [-1, -1, -1];

  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (!rule.selectorText || !rule.style?.color) continue;
      for (const part of rule.selectorText.split(',')) {
        const selector = part.trim();
        const withoutState = state === null ? selector : selector.replaceAll(`:${state}`, '');
        // A rule gated on a state the element is not in never applies.
        if (/:(hover|active|focus-visible|focus|disabled)\b/.test(withoutState)) continue;
        if (!element.matches(withoutState)) continue;

        const spec = specificity(selector);
        if (compare(spec, winningSpecificity) >= 0) {
          winningSpecificity = spec;
          winner = { selector, color: rule.style.color };
        }
      }
    }
  }
  return winner;
}

/** Follow a `var()` chain to a concrete colour, in one theme. */
function resolveVar(value, theme) {
  const reference = value.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return reference ? tokenValue(reference[1], theme) : value.trim();
}

/* A token's value per theme. Read straight out of tokens.css: jsdom exposes
   custom properties on neither getComputedStyle nor CSSStyleDeclaration, so
   the stylesheet text is the only place these values exist in this test. */
function tokenValue(name, theme) {
  const block =
    theme === 'dark'
      ? TOKENS_CSS.match(/\[data-theme='dark'\],\s*\.dark\s*\{([\s\S]*?)\n\}/)[1]
      : '';
  const root = TOKENS_CSS.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
  const find = (text) => [...text.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].at(-1)?.[1];
  const raw = find(block) ?? find(root);
  if (raw === undefined) return undefined;
  const reference = raw.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return reference ? tokenValue(reference[1], theme) : raw.trim();
}

const THEMES = ['light', 'dark'];
const STATES = [
  [null, 'resting'],
  ['hover', 'hovered'],
  ['active', 'pressed'],
];

/* Every variant, and the token that paints what sits behind its label in each
   state — so the label is measured against what is actually under it rather
   than against the page background. `--secondary` and `--ghost` paint no fill
   of their own when resting, so the page shows through and `--bg` is right.

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
  /** One live anchor per `${modifier}:${theme}`, all in the same document. */
  const anchors = new Map();

  beforeAll(() => {
    const style = document.createElement('style');
    style.textContent = `${TOKENS_CSS}\n${BUTTON_CSS}`;
    document.head.appendChild(style);

    for (const theme of THEMES) {
      const host = document.createElement('div');
      if (theme === 'dark') host.setAttribute('data-theme', 'dark');
      for (const { modifier } of VARIANTS) {
        const anchor = document.createElement('a');
        anchor.className = `ds-button ds-button--${modifier}`;
        anchor.href = '#';
        anchor.textContent = 'Read the guide';
        host.appendChild(anchor);
        anchors.set(`${modifier}:${theme}`, anchor);
      }
      document.body.appendChild(host);
    }
  });

  it('loaded the real stylesheets, not an empty document', () => {
    const selectors = [...document.styleSheets[0].cssRules].map((r) => r.selectorText);
    expect(selectors).toContain('a:hover');
    for (const { modifier } of VARIANTS) {
      expect(selectors.join('\n')).toContain(`.ds-button--${modifier}:hover`);
    }
  });

  it('pins the specificities the bug turned on', () => {
    // (0,1,1) beats (0,1,0) — this is why the element rule won.
    expect(specificity('a:hover')).toEqual([0, 1, 1]);
    expect(specificity('.ds-button--accent')).toEqual([0, 1, 0]);
    // (0,2,0) beats (0,1,1) — this is the fix.
    expect(specificity('.ds-button--accent:hover')).toEqual([0, 2, 0]);
  });

  for (const { modifier, threshold, fills } of VARIANTS) {
    for (const theme of THEMES) {
      for (const [state, label] of STATES) {
        it(`--${modifier}, ${theme}, ${label} >= ${threshold}:1`, () => {
          const anchor = anchors.get(`${modifier}:${theme}`);
          const winner = resolveColor(anchor, state);
          expect(winner, `nothing set a color for --${modifier} ${label}`).not.toBeNull();

          const foreground = resolveVar(winner.color, theme);
          const background = tokenValue(fills[label], theme);
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
      for (const theme of THEMES) {
        const winner = resolveColor(anchors.get(`${modifier}:${theme}`), 'hover');
        expect(winner.selector, `--${modifier} ${theme} hover`).not.toBe('a:hover');
        expect(winner.color, `--${modifier} ${theme} hover`).not.toBe('var(--link-hover)');
      }
    }
  });
});
