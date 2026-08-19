/* The measured half of the decision and assistant surfaces.
 *
 * component-css.test.mjs asserts the *mechanism* — that these sheets reach for
 * a semantic token rather than a base-scale one, and that a filled rule states
 * its colour. This file asserts the *outcome*: it reads the token each rule
 * actually names, resolves it inside each palette AND theme, and measures the
 * ratio.
 *
 * Four combinations, not two themes. Two of these three surfaces deliberately
 * reach for the palette-INdependent status family, and "it does not move with
 * the brand" is a claim only a sweep that changes the brand can check.
 *
 * Three pairings are covered because three are where the drafts were wrong:
 *
 *   1. the verdict-badge fills — a light mint tint behind a light green
 *      foreground in dark mode, light on light
 *   2. the assistant avatar mark — --accent used as 14px semibold text at
 *      2.53:1, a fill token doing a foreground's job
 *   3. the caveat — body copy that has to be read, beside a 3:1 rule that is
 *      the only thing marking the paragraph as a caution
 *
 * Nothing here hardcodes a token name from the design intent. Each assertion
 * parses the declaration out of the shipped stylesheet and measures whatever it
 * finds, so re-pointing a rule at a different token re-points the measurement
 * with it — and a rule that quietly loses its colour fails rather than going
 * quiet. Ratios come from @elirobinson/tokens' own helpers; none is written
 * down here.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contrastRatio } from '@elirobinson/tokens/color';
/* Through the exports map, not a `../../tokens/src` path: the same resolver
   packages/tokens gates itself with, which knows the four-block cascade
   including the (0,2,0) slate-dark selector. */
import { COMBINATIONS, PALETTES, THEMES, combinationValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '..', 'src', 'components');
/* Every token stylesheet, in cascade order. Reading tokens.css alone still
   parses and still returns a few hundred declarations — with no --status-* and
   no brand in them, so every ratio below would resolve to undefined and this
   file would fail on "is not declared" rather than on a colour. */
const TOKEN_SOURCES = readTokenStylesheets();
const VALUES = Object.fromEntries(
  COMBINATIONS.map((c) => [c.id, combinationValues(TOKEN_SOURCES, c)]),
);

const sheet = (path) => readFileSync(join(componentsDir, path), 'utf8');

/** Top-level rules as {selector, body}, comments stripped. */
function rules(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim().replace(/\s+/g, ' '),
    body: match[2],
  }));
}

/**
 * The SYSTEM token a declaration resolves to when no product layer is present.
 *
 * `var(--product-x, var(--system-token))` and a bare `var(--system-token)` both
 * answer `--system-token`: the product layer is optional by construction, so
 * what the system ships is what the last name in the chain resolves to. That is
 * also the only value this file can measure — a product's own palette is the
 * product's to measure, which is why product-layer.test.mjs enforces the
 * fallback rule instead of guessing at values.
 */
function systemToken(componentsPath, selector, property) {
  const rule = rules(sheet(componentsPath)).find((entry) => entry.selector === selector);
  expect(rule, `${selector} is missing from ${componentsPath}`).toBeDefined();
  const declaration = rule.body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+)`))?.[1];
  expect(
    declaration,
    `${selector} in ${componentsPath} declares no ${property} — a rule that stopped ` +
      'painting is a rule this file can no longer measure.',
  ).toBeDefined();
  const names = [...declaration.matchAll(/--[\w-]+/g)].map((match) => match[0]);
  const token = names.at(-1);
  expect(
    token?.startsWith('--product-'),
    `${selector} in ${componentsPath} resolves ${property} to ${token}, a product ` +
      'variable with no system fallback. See product-layer.test.mjs.',
  ).toBe(false);
  return token;
}

/** Ratio between two token names, resolved inside one palette x theme. */
function ratio(combination, foreground, background) {
  const fg = VALUES[combination].get(foreground);
  const bg = VALUES[combination].get(background);
  expect(fg, `${foreground} is not declared in ${combination}`).toBeDefined();
  expect(bg, `${background} is not declared in ${combination}`).toBeDefined();
  const measured = contrastRatio(fg, bg);
  expect(
    measured,
    `${foreground} (${fg}) on ${background} (${bg}) is not measurable`,
  ).not.toBeNull();
  return measured;
}

it('resolved every palette x theme combination — the token reader has not gone quiet', () => {
  expect(COMBINATIONS.length).toBe(PALETTES.length * THEMES.length);
  expect(COMBINATIONS.length).toBeGreaterThan(THEMES.length);
  for (const { id } of COMBINATIONS) {
    expect(VALUES[id].size, `${id} resolved no tokens`).toBeGreaterThan(50);
  }
  // --bg differs between themes, --accent between palettes. Without both, a
  // reader that had collapsed to one combination would pass everything here.
  expect(VALUES['ember/light'].get('--bg')).not.toBe(VALUES['ember/dark'].get('--bg'));
  expect(VALUES['ember/light'].get('--accent')).not.toBe(VALUES['slate/light'].get('--accent'));
});

/* ------------------------------------------------------------------------ *
 * 1. The verdict-badge fills
 * ------------------------------------------------------------------------ */

describe('a verdict badge is readable on its own fill, in both themes', () => {
  const VERDICTS = ['go', 'no', 'hold'];

  it('still has the three verdict rules this file measures', () => {
    const selectors = rules(sheet('molecules/VerdictBadge.css')).map((rule) => rule.selector);
    for (const verdict of VERDICTS) {
      expect(selectors).toContain(`.ds-verdict--${verdict}`);
    }
  });

  for (const verdict of VERDICTS) {
    const selector = `.ds-verdict--${verdict}`;
    const fill = systemToken('molecules/VerdictBadge.css', selector, 'background');
    const text = systemToken('molecules/VerdictBadge.css', selector, 'color');

    for (const { id } of COMBINATIONS) {
      it(`${id}: ${selector} draws ${text} on ${fill}`, () => {
        expect(Number(ratio(id, text, fill).toFixed(2))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  /* The bug this pairing was written for: a fill that stays put while its
     foreground follows the theme. Both members have to move, so the fill is
     asserted to differ between themes rather than merely to measure well in
     each — a fixed tint can pass the ratio above in light and still be a
     94%-light chip on a black page. */
  for (const verdict of VERDICTS) {
    it(`.ds-verdict--${verdict} paints a fill that follows the theme`, () => {
      const fill = systemToken(
        'molecules/VerdictBadge.css',
        `.ds-verdict--${verdict}`,
        'background',
      );
      expect(
        VALUES['ember/light'].get(fill),
        `${fill} resolves to the same value in both themes, so it is a fixed fill ` +
          'under a themed foreground — the pair that inverts.',
      ).not.toBe(VALUES['ember/dark'].get(fill));
    });
  }

  /* And the other axis. A verdict is a status, not a brand statement: green
     means go under every palette. If a future palette "helpfully" re-hued the
     status family to match its accent, every ratio above would still pass and
     the badge would have changed meaning. */
  for (const verdict of VERDICTS) {
    it(`.ds-verdict--${verdict} does NOT follow the palette`, () => {
      const selector = `.ds-verdict--${verdict}`;
      for (const property of ['background', 'color']) {
        const token = systemToken('molecules/VerdictBadge.css', selector, property);
        for (const theme of THEMES) {
          const values = PALETTES.map((palette) => VALUES[`${palette}/${theme}`].get(token));
          expect(
            new Set(values).size,
            `${token} differs across palettes in ${theme}: ${values.join(' vs ')}`,
          ).toBe(1);
        }
      }
    });
  }
});

/* ------------------------------------------------------------------------ *
 * 2. The assistant avatar mark
 * ------------------------------------------------------------------------ */

describe('the assistant avatar mark is legible on its own circle, in both themes', () => {
  const mark = systemToken(
    'ai/ChatMessage.css',
    '.ds-chat-message--received .ds-chat-message__mark',
    'color',
  );
  const circle = systemToken('ai/ChatMessage.css', '.ds-chat-message__avatar', 'background');

  /* The draft drew this mark in --accent. It is 14px semibold text, so it is
     text under SC 1.4.3 and not a graphic under 1.4.11 — the 3:1 exemption
     does not apply and 2.53:1 is not close. */
  for (const { id } of COMBINATIONS) {
    it(`${id}: ${mark} on ${circle}`, () => {
      expect(Number(ratio(id, mark, circle).toFixed(2))).toBeGreaterThanOrEqual(4.5);
    });

    it(`${id}: ${mark} also clears AA against the page`, () => {
      expect(Number(ratio(id, mark, '--bg').toFixed(2))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('is not painted with the fill token the draft used', () => {
    expect(mark).not.toBe('--accent');
  });

  /* Nor with the brand's readable step. --accent-ink would clear 4.5:1 in all
     four, so a ratio sweep alone would never object — but it swaps hue with
     the palette, and the assistant's mark is an identity rather than a brand
     accent. A product that wants its own hue sets --product-signal-fg. */
  it('does not re-hue with the palette', () => {
    expect(mark).not.toBe('--accent-ink');
    for (const theme of THEMES) {
      const values = PALETTES.map((palette) => VALUES[`${palette}/${theme}`].get(mark));
      expect(new Set(values).size, `${mark} differs across palettes in ${theme}`).toBe(1);
    }
  });

  /* The avatar circle is an outline, so the edge is what says where it is. */
  it('draws its edge with the 3:1 control token', () => {
    const rule = rules(sheet('ai/ChatMessage.css')).find(
      (entry) => entry.selector === '.ds-chat-message__avatar',
    );
    expect(rule.body).toMatch(/border:[^;]*var\(--border-control\)/);
  });
});

/* ------------------------------------------------------------------------ *
 * 3. The caveat
 * ------------------------------------------------------------------------ */

describe('the caveat reads as body copy on the card, in both themes', () => {
  const text = systemToken('organisms/DecisionCard.css', '.ds-decision__caveat', 'color');
  const surface = systemToken('organisms/DecisionCard.css', '.ds-decision', 'background');
  const rule = systemToken('organisms/DecisionCard.css', '.ds-decision__caveat', 'border-left');

  for (const { id } of COMBINATIONS) {
    it(`${id}: caveat text ${text} on ${surface} clears 4.5:1 (SC 1.4.3)`, () => {
      expect(Number(ratio(id, text, surface).toFixed(2))).toBeGreaterThanOrEqual(4.5);
    });

    /* The rule is the only thing marking the paragraph as a caution, which
       makes it a meaningful non-text graphic at 3:1 rather than decoration.
       --signal-500, which the draft used, is also base-scale and would not
       move with the theme at all. */
    it(`${id}: the caution rule ${rule} on ${surface} clears 3:1 (SC 1.4.11)`, () => {
      expect(Number(ratio(id, rule, surface).toFixed(2))).toBeGreaterThanOrEqual(3);
    });
  }

  /* The rule must be --status-warning-border and not --status-warning. The
     bare warning fill is 1.87:1 on a light surface — the documented exception
     in the token set — so a caution rule drawn in it is invisible on exactly
     the page where a caution matters most. The assertion above would catch it,
     but only this one says which token is the fix. */
  it('draws the rule with the token that carries the 3:1, not the bare fill', () => {
    expect(rule).toBe('--status-warning-border');
    expect(Number(ratio('ember/light', '--status-warning', surface).toFixed(2))).toBeLessThan(3);
  });
});

/* ------------------------------------------------------------------------ *
 * The streaming caret, measured for the same reason
 * ------------------------------------------------------------------------ */

describe('the streaming caret is visible as a state indicator, in both themes', () => {
  const fill = systemToken('ai/StreamingCaret.css', '.ds-streaming-caret', 'background');

  it('is not painted with the fill token the draft used', () => {
    expect(fill).not.toBe('--accent');
  });

  for (const { id } of COMBINATIONS) {
    it(`${id}: ${fill} on --bg clears 3:1 (SC 1.4.11)`, () => {
      expect(Number(ratio(id, fill, '--bg').toFixed(2))).toBeGreaterThanOrEqual(3);
    });
  }
});
