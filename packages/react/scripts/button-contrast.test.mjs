/* The reported bug, end to end.
 *
 * component-css.test.mjs asserts the *mechanism* — that every filled variant
 * carries a `color` declaration in each state. This file asserts the
 * *outcome*: resolve the cascade over the real shipped stylesheets and measure
 * what an `<a class="ds-button ds-button--accent">` label actually renders as,
 * resting, hovered and pressed, in both themes.
 *
 * Those are two different claims. A `color` declaration that loses the cascade
 * satisfies the first and not the second, and losing the cascade is exactly
 * what happened: tokens.css's `a:hover` (0,1,1) beat `.ds-button--accent`
 * (0,1,0), and the label came out amber on amber at 2.31:1.
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
/* Which fill each state paints, so the label is measured against what is
   actually behind it rather than against the page background. */
const FILL = { resting: '--accent', hovered: '--accent-hover', pressed: '--accent-press' };

describe('an <a class="ds-button ds-button--accent"> label clears 4.5:1', () => {
  const anchors = {};

  beforeAll(() => {
    const style = document.createElement('style');
    style.textContent = `${TOKENS_CSS}\n${BUTTON_CSS}`;
    document.head.appendChild(style);

    for (const theme of THEMES) {
      const host = document.createElement('div');
      if (theme === 'dark') host.setAttribute('data-theme', 'dark');
      const anchor = document.createElement('a');
      anchor.className = 'ds-button ds-button--accent';
      anchor.href = '#';
      anchor.textContent = 'Read the guide';
      host.appendChild(anchor);
      document.body.appendChild(host);
      anchors[theme] = anchor;
    }
  });

  it('loaded the real stylesheets, not an empty document', () => {
    const selectors = [...document.styleSheets[0].cssRules].map((r) => r.selectorText);
    expect(selectors).toContain('a:hover');
    expect(selectors).toContain('.ds-button--accent:hover');
  });

  it('pins the specificities the bug turned on', () => {
    // (0,1,1) beats (0,1,0) — this is why the element rule won.
    expect(specificity('a:hover')).toEqual([0, 1, 1]);
    expect(specificity('.ds-button--accent')).toEqual([0, 1, 0]);
    // (0,2,0) beats (0,1,1) — this is the fix.
    expect(specificity('.ds-button--accent:hover')).toEqual([0, 2, 0]);
  });

  for (const theme of THEMES) {
    for (const [state, label] of STATES) {
      it(`${theme}, ${label}`, () => {
        const anchor = anchors[theme];
        const winner = resolveColor(anchor, state);
        expect(winner, `nothing set a color for ${label}`).not.toBeNull();

        const foreground = resolveVar(winner.color, theme);
        const background = tokenValue(FILL[label], theme);
        const measured = contrastRatio(foreground, background);

        expect(measured, `${winner.selector} gives ${foreground} on ${background}`).not.toBeNull();
        expect(
          Number(measured.toFixed(2)),
          `${winner.selector} wins the cascade and puts ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('is won by the variant, not by the global a:hover', () => {
    for (const theme of THEMES) {
      const winner = resolveColor(anchors[theme], 'hover');
      expect(winner.selector, `${theme} hover`).not.toBe('a:hover');
      expect(winner.color, `${theme} hover`).not.toBe('var(--link-hover)');
    }
  });
});
