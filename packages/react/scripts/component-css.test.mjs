/* The second layer under packages/tokens' contrast.test.mjs.
 *
 * That file proves the *tokens* clear their thresholds. It cannot see a
 * component reaching for the wrong one — a decorative `--border` painted as an
 * input's edge measures 1.24:1 no matter how correct the token itself is. This
 * file reads every component stylesheet and asserts the three rules that a
 * correct token set can still be undone by:
 *
 *   1. a control's edge uses --border-control, not --border/--border-strong
 *   2. a rule that paints a background restates `color` in each of its states
 *   3. a painted colour is a semantic token, never a fixed base-scale value
 *
 * Rule 2 is the amber-on-amber bug: tokens.css's global `a:hover` is (0,1,1)
 * and `.ds-button--accent` is (0,1,0), so a variant whose :hover moved only
 * background-color let the element rule repaint its label — 2.31:1.
 *
 * Rule 3 is the dark-mode class the first two cannot reach: --ink-1000 is
 * black in both themes, so a tab underline, a switch track and a tooltip fill
 * were each 1.00:1 against a black page while every token they used was
 * individually correct.
 *
 * Both lists carry named exemptions rather than clever heuristics. An entry is
 * a claim about a specific selector, which is reviewable; a heuristic that
 * silently stops matching is not.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const componentsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components');

/** Every `<tier>/<Name>.css` under src/components, as {file, css}. */
function stylesheets(dir = componentsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    if (!entry.name.endsWith('.css')) return [];
    return [{ file: relative(componentsDir, path), css: readFileSync(path, 'utf8') }];
  });
}

/** Top-level rules as {selector, body}. Nested at-rules are flattened out. */
function rules(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim().replace(/\s+/g, ' '),
    body: match[2],
  }));
}

const SHEETS = stylesheets();

it('finds the component stylesheets it is supposed to be checking', () => {
  // A path change that emptied this list would make every assertion below
  // pass vacuously, which is the one way this file could go quiet.
  expect(SHEETS.length).toBeGreaterThan(20);
});

/* ------------------------------------------------------------------------ *
 * 1. Control edges
 * ------------------------------------------------------------------------ */

/* A selector naming one of these is a control whose edge a user relies on. */
const CONTROL_SELECTOR =
  /(button|input|trigger|__action|switch|chip|pagination|segmented|search-field|kbd|indicator|option|combobox)/i;

/* Selectors that match CONTROL_SELECTOR but are not a control boundary. Each
   says why — these are surfaces and dividers that happen to share a word. */
const EDGE_EXEMPT = {
  '.ds-dropdown__content': 'floating panel edge, a surface seam over a shadow',
  '.ds-popover__content': 'floating panel edge, a surface seam over a shadow',
  '.ds-combobox__list': 'floating panel edge, a surface seam over a shadow',
  '.ds-command-palette__input': 'sits inside a dialog surface, edge is not the affordance',
};

describe('control edges use --border-control', () => {
  for (const { file, css } of SHEETS) {
    for (const { selector, body } of rules(css)) {
      const border = body.match(/(?:^|\s)border(?:-[a-z]+)?:\s*[^;]*var\((--border(?:-strong)?)\)/);
      if (!border || !CONTROL_SELECTOR.test(selector)) continue;
      if (selector in EDGE_EXEMPT) continue;

      it(`${file}: ${selector} does not paint its edge with ${border[1]}`, () => {
        expect.fail(
          `${selector} in ${file} uses var(${border[1]}) for a border. That token is ` +
            'decorative (1.24:1 / 1.53:1) and this selector reads as a control, whose ' +
            'edge needs 3:1 under SC 1.4.11. Use var(--border-control), or add the ' +
            'selector to EDGE_EXEMPT in this file with the reason it is not a control.',
        );
      });
    }
  }

  it('has at least one control actually using --border-control', () => {
    const users = SHEETS.filter(({ css }) => css.includes('var(--border-control)'));
    expect(users.length).toBeGreaterThan(5);
  });
});

/* ------------------------------------------------------------------------ *
 * 2. A filled rule owns its text colour in every state
 * ------------------------------------------------------------------------ */

const STATE = /:(hover|active|focus|focus-visible|disabled)\b/;

/* State rules that legitimately paint a background without a colour, because
   the element they target has no text of its own. */
const COLOR_EXEMPT = [
  /__track|__thumb|__fill|__bar|__dot|__indicator-line|::(before|after|-webkit-)/,
];

describe('a rule that paints a background in a state also states its color', () => {
  for (const { file, css } of SHEETS) {
    for (const { selector, body } of rules(css)) {
      if (!STATE.test(selector)) continue;
      if (!/(?:^|\s|;)background(?:-color)?:/.test(body)) continue;
      if (COLOR_EXEMPT.some((pattern) => pattern.test(selector))) continue;

      it(`${file}: ${selector} restates color`, () => {
        expect(
          /(?:^|\s|;)color:/.test(body),
          `${selector} in ${file} sets a background but not a color. tokens.css's global ` +
            '`a:hover` is (0,1,1) and beats a (0,1,0) variant class, so an <a> carrying ' +
            'this class keeps the new fill and has its label repainted --link-hover. That ' +
            'is the amber-on-amber bug, at 2.31:1. Restate `color` here, or add the ' +
            'selector to COLOR_EXEMPT if it paints no text.',
        ).toBe(true);
      });
    }
  }
});

/* ------------------------------------------------------------------------ *
 * 3. A painted colour follows the theme
 * ------------------------------------------------------------------------ */

/* The base scales are fixed values — --ink-1000 is black in both themes. A
   component that paints one is asserting that the colour is right on a white
   page *and* a black one, which is almost never true. This is the rule that
   catches the whole dark-mode class: a black tab underline at 1.00:1, a black
   switch track at 1.00:1, a black tooltip on a black page, a near-white badge
   fill carrying themed text at 1.37:1. Semantic tokens flip; scales do not. */
const BASE_SCALE = /var\((--(?:ink|signal|anchor)-\d+)\)/;
const PAINTS =
  /(?:^|[;\s])(color|background(?:-color)?|border(?:-[a-z]+)?-color|border(?:-[a-z]+)?)\s*:/;

/* Deliberate fixed pairs: both the fill and the text are scale values, so the
   pair is self-consistent on any page. Each records its measured ratio, which
   is the same evidence the token rules demand. */
const THEME_EXEMPT = {
  '.ds-badge--signal': '--signal-800 on --signal-100, a fixed pair — 8.05:1 both themes',
  '.ds-badge--anchor': '--anchor-700 on --anchor-100, a fixed pair — 11.84:1 both themes',
  '.ds-switch__input:checked::before': 'geometry only, no colour',
};

describe('components paint semantic tokens, not fixed base-scale values', () => {
  for (const { file, css } of SHEETS) {
    for (const { selector, body } of rules(css)) {
      if (selector in THEME_EXEMPT) continue;
      for (const line of body.split(';')) {
        if (!PAINTS.test(`;${line}:`) && !PAINTS.test(`;${line};`)) continue;
        const scale = line.match(BASE_SCALE);
        if (!scale || !PAINTS.test(`;${line.split(':')[0]}:`)) continue;

        it(`${file}: ${selector} does not paint ${scale[1]}`, () => {
          expect.fail(
            `${selector} in ${file} paints var(${scale[1]}), a fixed base-scale value. ` +
              'The scales do not respond to [data-theme="dark"], so this colour is ' +
              'asserting it works on a white page and a black one. Use the semantic ' +
              'token that flips (--fg, --bg, --bg-inverse, --border-control, ' +
              '--accent-ink, --status-*-tint), or add the selector to THEME_EXEMPT ' +
              'with the measured ratio proving the pair holds in both themes.',
          );
        });
      }
    }
  }

  it('still has scale tokens available to catch — the regex has not gone stale', () => {
    expect(BASE_SCALE.test('background: var(--ink-1000);')).toBe(true);
    expect(BASE_SCALE.test('color: var(--fg);')).toBe(false);
  });
});

describe('Button, where the bug was reported', () => {
  const button = SHEETS.find(({ file }) => file.endsWith('Button.css'));

  it('is still in the set being checked', () => {
    expect(button).toBeDefined();
  });

  for (const variant of ['primary', 'accent', 'secondary', 'ghost']) {
    it(`--${variant} states its color resting, hovered, and pressed`, () => {
      for (const state of ['', ':hover', ':active']) {
        const rule = rules(button.css).find((r) => r.selector === `.ds-button--${variant}${state}`);
        expect(rule, `.ds-button--${variant}${state} is missing`).toBeDefined();
        expect(
          /(?:^|\s|;)color:/.test(rule.body),
          `.ds-button--${variant}${state} does not state a color`,
        ).toBe(true);
      }
    });
  }

  it('drops the underline so an <a class="ds-button"> reads as a control', () => {
    expect(button.css).toMatch(/\.ds-button\s*\{[\s\S]*?text-decoration:\s*none/);
  });
});
