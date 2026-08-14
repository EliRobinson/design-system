/* A control does not dress up as a link.
 *
 * The reported pattern (#62) is a filled button whose label is underlined —
 * an orange fill, a black label, and a black underline under it. The underline
 * is the part that is a defect on its own: it borrows the one visual signal a
 * hyperlink owns and puts it inside a control, so a reader cannot tell from
 * looking whether the thing navigates or acts.
 *
 * The colour half of that report is not a defect here and is measured
 * elsewhere: --accent-fg on --accent is 8.30:1 resting, 10.17:1 hovered and
 * 5.69:1 pressed, asserted per-token in packages/tokens' contrast.test.mjs and
 * end-to-end over the real cascade in button-contrast.test.mjs. Nothing in this
 * file re-measures it.
 *
 * What was not pinned is the underline, and it turns on the cascade rather than
 * on any single declaration. tokens.css underlines every `a` globally, so an
 * `<a class="ds-button">` is underlined unless something outranks that rule —
 * exactly the shape of the amber-on-amber bug, one property over. A text search
 * for `text-decoration: none` in Button.css cannot see whether that declaration
 * wins; this resolves the cascade with jsdom's own selector engine and reads
 * the winner, the way button-contrast.test.mjs does for `color`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { compareSpecificity as compare, specificity } from './specificity.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '..', 'src', 'components');

const TOKENS_CSS = readFileSync(join(here, '..', '..', 'tokens', 'src', 'tokens.css'), 'utf8');

/** Every component stylesheet, so the cascade under test is the shipped one. */
function componentCss(dir = componentsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return componentCss(path);
    return entry.name.endsWith('.css') ? [readFileSync(path, 'utf8')] : [];
  });
}

/* jsdom keeps `text-decoration` and `text-decoration-line` as two separate
   properties — it does not expand the shorthand — so both have to be read or a
   rule written in the other spelling is invisible here. */
const LINE_PROPERTIES = ['text-decoration-line', 'text-decoration'];

/** The declaration that wins for the underline, resolved over every loaded sheet. */
function resolveUnderline(element, state) {
  let winner = null;
  let winning = [-1, -1, -1];

  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (!rule.selectorText || !rule.style) continue;
      const property = LINE_PROPERTIES.find((name) => rule.style.getPropertyValue(name));
      if (!property) continue;

      for (const part of rule.selectorText.split(',')) {
        const selector = part.trim();
        const withoutState = state === null ? selector : selector.replaceAll(`:${state}`, '');
        // A rule gated on a state the element is not in never applies.
        if (/:(hover|active|focus-visible|focus|disabled)\b/.test(withoutState)) continue;
        if (!element.matches(withoutState)) continue;

        const spec = specificity(selector);
        if (compare(spec, winning) >= 0) {
          winning = spec;
          winner = { selector, value: rule.style.getPropertyValue(property).trim() };
        }
      }
    }
  }
  return winner;
}

const THEMES = ['light', 'dark'];
const STATES = [
  [null, 'resting'],
  ['hover', 'hovered'],
  ['active', 'pressed'],
  ['focus-visible', 'focused'],
];

/* Every class tokens.css names in its `a.<control>` block, plus each Button
   variant. These are the controls a consumer is invited to render as an
   anchor, which is the only way the global `a` underline can reach them. */
const CONTROLS = [
  ['a', 'ds-button ds-button--primary'],
  ['a', 'ds-button ds-button--accent'],
  ['a', 'ds-button ds-button--secondary'],
  ['a', 'ds-button ds-button--ghost'],
  ['a', 'ds-chip'],
  ['a', 'ds-badge'],
  ['a', 'ds-pagination__item'],
  ['button', 'ds-button ds-button--accent'],
];

describe('a filled control never renders its own label underlined', () => {
  const elements = {};

  beforeAll(() => {
    const style = document.createElement('style');
    style.textContent = [TOKENS_CSS, ...componentCss()].join('\n');
    document.head.appendChild(style);

    for (const theme of THEMES) {
      const host = document.createElement('div');
      if (theme === 'dark') host.setAttribute('data-theme', 'dark');
      for (const [tag, className] of CONTROLS) {
        const element = document.createElement(tag);
        element.className = className;
        if (tag === 'a') element.href = '#';
        element.textContent = 'New open house';
        host.appendChild(element);
        elements[`${theme}|${className}|${tag}`] = element;
      }
      document.body.appendChild(host);
    }
  });

  it('loaded the real stylesheets, with the global underline in them', () => {
    const rules = [...document.styleSheets[0].cssRules];
    const anchor = rules.find((rule) => rule.selectorText === 'a');
    expect(anchor, 'tokens.css no longer has a bare `a` rule').toBeDefined();
    expect(anchor.style.getPropertyValue('text-decoration')).toContain('underline');
    expect(rules.map((rule) => rule.selectorText)).toContain('.ds-button');
  });

  it('pins the specificities the underline turns on', () => {
    // The global underline is the weakest thing in the room, and has to stay
    // that way: (0,1,0) and (0,1,1) both outrank (0,0,1).
    expect(specificity('a')).toEqual([0, 0, 1]);
    expect(specificity('.ds-button')).toEqual([0, 1, 0]);
    expect(specificity('a.ds-button')).toEqual([0, 1, 1]);
  });

  for (const theme of THEMES) {
    for (const [tag, className] of CONTROLS) {
      for (const [state, label] of STATES) {
        it(`${theme}, <${tag} class="${className}">, ${label}`, () => {
          const element = elements[`${theme}|${className}|${tag}`];
          const winner = resolveUnderline(element, state);

          if (tag === 'a') {
            expect(winner, `nothing set a text-decoration for ${label}`).not.toBeNull();
          } else if (winner === null) {
            // A <button> is not underlined by the UA, so no declaration is a
            // pass. An underlining one is not.
            return;
          }
          expect(
            winner.value,
            `${winner.selector} wins and gives "${winner.value}" — a control ` +
              'whose label is underlined reads as a hyperlink. Restate ' +
              '`text-decoration: none` on a selector that outranks it.',
          ).not.toContain('underline');
        });
      }
    }
  }

  it('is won by the control class, not by the global `a` rule', () => {
    for (const theme of THEMES) {
      const winner = resolveUnderline(elements[`${theme}|ds-button ds-button--accent|a`], null);
      expect(winner.selector, theme).not.toBe('a');
    }
  });

  it('would notice if the guard were removed', () => {
    /* The whole file rests on resolveUnderline picking the more specific rule.
       If it ever returned the first match instead, every assertion above would
       still pass on a stylesheet that had lost its `text-decoration: none`. */
    const probe = document.createElement('style');
    probe.textContent = '#ds-underline-probe.ds-button { text-decoration: underline; }';
    document.head.appendChild(probe);

    const element = document.body.querySelector('a.ds-button');
    element.id = 'ds-underline-probe';
    try {
      expect(resolveUnderline(element, null).value).toContain('underline');
    } finally {
      element.removeAttribute('id');
      probe.remove();
    }
  });
});
