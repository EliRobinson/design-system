/* The second layer under packages/tokens' contrast.test.mjs.
 *
 * That file proves the *tokens* clear their thresholds. It cannot see a
 * component reaching for the wrong one — a decorative `--border` painted as an
 * input's edge measures 1.24:1 no matter how correct the token itself is. This
 * file reads every component stylesheet and asserts the four rules that a
 * correct token set can still be undone by:
 *
 *   1. a control's edge uses --border-control, not --border/--border-strong
 *   2. a rule that paints a background restates `color` in each of its states
 *   3. a painted colour is a semantic token, never a fixed base-scale value
 *   4. a control's own label is not underlined
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
 * Rule 4 is not about contrast at all. An underline is the one signal a
 * hyperlink owns, and a control that draws one under its own label stops
 * telling a reader whether it navigates or acts. Whether the declaration that
 * wins is an underline is a cascade question, settled in
 * control-affordance.test.mjs; this is the flat sweep that says no component
 * stylesheet contains such a declaration in the first place.
 *
 * Both lists carry named exemptions rather than clever heuristics. An entry is
 * a claim about a specific selector, which is reviewable; a heuristic that
 * silently stops matching is not.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/* Reached through the exports map rather than by walking up to packages/tokens.
   Section 5 reads tokens.css, and button-contrast.test.mjs's header explains at
   length why a hand-spelled path into that package is how a reader and the
   thing it reads come to disagree. */
import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';

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
/* Every property that puts colour on screen, not just the ones spelled
   `color` and `background`. `accent-color` is why this list is explicit: it
   paints the checked box of a native checkbox, it was set to --ink-1000, and
   the earlier pattern read the `-color` suffix as part of a border property
   and matched nothing — so a checked checkbox sat at 1.00:1 on a dark page
   while this file reported the sweep clean. */
const PAINTS = new RegExp(
  '(?:^|[;\\s])(' +
    [
      'color',
      'background(?:-color)?',
      'border(?:-[a-z]+)?(?:-color)?',
      'outline(?:-color)?',
      'accent-color',
      'caret-color',
      'text-decoration-color',
      'fill',
      'stroke',
    ].join('|') +
    ')\\s*:',
);

/* Selectors outside this rule. Badge's two brand chips used to be here as
   deliberate fixed pairs — self-consistent at 8.05:1 and 11.84:1 on any page,
   and still a 94%-light chip on a black one. They paint --accent-tint /
   --anchor-tint now, which invert, so the exemption is gone rather than
   re-justified: an exemption that outlives its reason is how a sweep goes
   quiet. */
const THEME_EXEMPT = {
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

/* ------------------------------------------------------------------------ *
 * 4. A control's label is not underlined
 * ------------------------------------------------------------------------ */

/* `text-decoration: underline` and its longhand. The other longhands are not
   a line — --thickness, --offset and --color only change one that is already
   there, and tokens.css uses -thickness deliberately to keep a hover
   affordance on a link that has lost its hue shift. */
const UNDERLINE = /(?:^|[;\s])text-decoration(?:-line)?\s*:\s*([^;]*underline[^;]*)/;

/* Selectors allowed to underline, each with the reason. Empty on purpose: no
   component in this system draws its own underline. Links get theirs from
   tokens.css's global `a` rule, which is where the signal belongs — an
   underline anywhere else is a control borrowing a hyperlink's one visual
   signal, which is the pattern reported in #62 (an orange button with a black
   underlined label). An entry here is a claim that a specific selector is
   genuinely a link. */
const UNDERLINE_EXEMPT = {};

describe('no component underlines its own label', () => {
  for (const { file, css } of SHEETS) {
    for (const { selector, body } of rules(css)) {
      if (selector in UNDERLINE_EXEMPT) continue;
      const underline = body.match(UNDERLINE);
      if (!underline) continue;

      it(`${file}: ${selector} does not underline`, () => {
        expect.fail(
          `${selector} in ${file} declares "${underline[1].trim()}". An underline is the ` +
            "one visual signal a hyperlink owns; drawn under a control's own label it " +
            'stops telling a reader whether the thing navigates or acts, and reads as a ' +
            'link wearing a button. Use weight, a fill, or a border for emphasis, or add ' +
            'the selector to UNDERLINE_EXEMPT with the reason it is genuinely a link.',
        );
      });
    }
  }

  it('still catches an underline — the pattern has not gone stale', () => {
    expect(UNDERLINE.test('text-decoration: underline;')).toBe(true);
    expect(UNDERLINE.test('  text-decoration-line: underline dotted;')).toBe(true);
    expect(UNDERLINE.test('text-decoration: none;')).toBe(false);
    expect(UNDERLINE.test('text-decoration-thickness: 2px;')).toBe(false);
    expect(UNDERLINE.test('text-underline-offset: 0.2em;')).toBe(false);
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

/* ------------------------------------------------------------------------ *
 * 5. Every native form control a component renders inherits the page's font
 * ------------------------------------------------------------------------ */

/* Issue #167. `<button>`, `<input>`, `<select>` and `<textarea>` do not inherit
 * `font`, so the UA stylesheet supplies Arial (monospace for `<textarea>`), and
 * a component rule that sets `font-size` and nothing else typesets REAL WORDS
 * in it. Five shipped controls did — .ds-search-field__input, which is the text
 * the user TYPES, plus .ds-pagination__item, .ds-segmented-control__item,
 * .ds-accordion__trigger and .ds-date-picker__day.
 *
 * The fix is one rule in tokens.css, so the check is about that rule rather
 * than about the component sheets: a per-component sweep for "sets font-size
 * without font-family" would now match all five and be RIGHT to, because the
 * reset is what supplies the family. Checking the reset is what has teeth.
 *
 * Three claims, and why each is here rather than in packages/tokens'
 * form-font-cascade.test.mjs:
 *
 *   COVERAGE is a cross-package question. It asks whether the element set the
 *   reset names still covers what THIS package renders, and the answer changes
 *   when a component lands, not when tokens.css does. Today that is <button>
 *   and <input>; a Textarea or Select component is what makes it fire.
 *
 *   LAYERED and SHORTHAND are measured properly in a browser next door, and
 *   that file skips itself when no Chromium is present — which is the bare CI
 *   image. These two static restatements are what runs everywhere. They are
 *   deliberately weaker: they assert the rule's shape, never its effect.
 */

const tokensCss = readFileSync(join(TOKENS_SRC_DIR, 'tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** The text inside every `@layer base { … }` block, brace-matched. */
function layerBaseBlocks(css) {
  const blocks = [];
  const opener = /@layer\s+base\s*\{/g;
  while (opener.exec(css) !== null) {
    let depth = 1;
    let index = opener.lastIndex;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(opener.lastIndex, index - 1));
  }
  return blocks;
}

/** Every rule resetting the font to `inherit`, with whether it used the shorthand. */
function fontResets(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => /(?:^|[;\s])font(?:-family)?\s*:\s*inherit/.test(match[2]))
    .map((match) => ({
      selector: match[1].trim().replace(/\s+/g, ' '),
      shorthand: /(?:^|[;\s])font\s*:\s*inherit/.test(match[2]),
    }));
}

/** Native form elements a component renders, read from the TSX, not the CSS. */
function renderedFormElements(dir = componentsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return renderedFormElements(path);
    if (!entry.name.endsWith('.tsx')) return [];
    const tsx = readFileSync(path, 'utf8');
    return [...tsx.matchAll(/<(button|input|select|textarea|optgroup)[\s/>]/g)].map((m) => m[1]);
  });
}

const LAYERED_RESETS = fontResets(layerBaseBlocks(tokensCss).join('\n'));
const ALL_RESETS = fontResets(tokensCss);
const RENDERED = [...new Set(renderedFormElements())].sort();

/* Two rules, not one list. ::file-selector-button is split off deliberately:
   an unrecognised selector invalidates the whole rule it sits in, so keeping it
   in the list would silently take the four real elements down with it on any
   engine that does not parse it. tokens.css carries the measurement. */
const ELEMENT_RESET = 'button, input, optgroup, select, textarea';
const PSEUDO_RESET = '::file-selector-button';

describe('the form-control font reset in tokens.css', () => {
  it('is exactly the two rules it should be — #167', () => {
    /* A reset outside the layer, or a third one, would be two answers to one
       question, and every assertion below would be checking whichever this
       happened to find first. */
    expect(ALL_RESETS).toHaveLength(2);
    expect(ALL_RESETS.map((reset) => reset.selector).sort()).toEqual(
      [ELEMENT_RESET, PSEUDO_RESET].sort(),
    );
  });

  it('keeps ::file-selector-button out of the element list', () => {
    /* Measured in Chromium: one bogus pseudo-element added to the list sent a
       <button> back to the UA's Arial while `body` was Georgia — the entire
       rule is dropped, not just the unparsed entry. Merging these two rules
       back together would make the whole fix silently conditional on the
       engine knowing one pseudo-element. */
    const elementReset = ALL_RESETS.find((reset) => reset.selector === ELEMENT_RESET);
    expect(elementReset, 'the element reset is no longer a rule of its own').toBeDefined();
    expect(elementReset.selector).not.toContain('::');
  });

  it('is inside @layer base, so a consumer utility still outranks it', () => {
    /* Unlayered it is (0,0,1) and still beats `.font-mono` and `.text-2xl` in
       @layer utilities, because unlayered wins over every layer regardless of
       specificity — a consumer who asked in markup for a monospace button got
       Geist and had no stylesheet of their own that could say otherwise. That
       is issue #112 in a new spelling, and it is measured in a browser in
       packages/tokens' form-font-cascade.test.mjs. */
    expect(LAYERED_RESETS.map((reset) => reset.selector).sort()).toEqual(
      [ELEMENT_RESET, PSEUDO_RESET].sort(),
    );
  });

  it('uses the `font` shorthand, matching Tailwind preflight', () => {
    /* Not a style preference. Preflight resets these same elements with
       `font: inherit`, so a Tailwind consumer already renders that way while
       our own docs — which ship no preflight — mint baselines from the unreset
       rendering. `font-family: inherit` alone leaves line-height at the UA's
       `normal` and keeps the two diverged for good. */
    for (const reset of LAYERED_RESETS) {
      expect(reset.shorthand, `${reset.selector} does not use the shorthand`).toBe(true);
    }
  });

  it('covers every native form element a component renders', () => {
    /* Anti-vacuous: a TSX path change that emptied this list would make the
       loop below pass without checking anything. */
    expect(RENDERED).toContain('button');
    expect(RENDERED).toContain('input');

    const covered = LAYERED_RESETS.flatMap((reset) =>
      reset.selector.split(',').map((entry) => entry.trim()),
    );
    for (const element of RENDERED) {
      expect(
        covered,
        `components render <${element}>, which the tokens.css font reset does not name. ` +
          'It will typeset in the UA font while everything around it is --font-sans — ' +
          'issue #167. Add it to the reset rather than patching the component.',
      ).toContain(element);
    }
  });
});
