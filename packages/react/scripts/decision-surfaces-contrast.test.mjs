/* The measured half of the decision and assistant surfaces.
 *
 * component-css.test.mjs asserts the *mechanism* — that these sheets reach for
 * a semantic token rather than a base-scale one, and that a filled rule states
 * its colour. This file asserts the *outcome*: it reads the token each rule
 * actually names, resolves it inside each theme, and measures the ratio.
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
import { describe, expect, it } from 'vitest';

import { themeValues } from '../../tokens/src/contrast.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '..', 'src', 'components');
const tokensCss = readFileSync(join(here, '..', '..', 'tokens', 'src', 'tokens.css'), 'utf8');

const THEMES = ['light', 'dark'];
const VALUES = Object.fromEntries(THEMES.map((theme) => [theme, themeValues(tokensCss, theme)]));

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

/** Ratio between two token names, resolved inside one theme. */
function ratio(theme, foreground, background) {
  const fg = VALUES[theme].get(foreground);
  const bg = VALUES[theme].get(background);
  expect(fg, `${foreground} is not declared in tokens.css`).toBeDefined();
  expect(bg, `${background} is not declared in tokens.css`).toBeDefined();
  const measured = contrastRatio(fg, bg);
  expect(
    measured,
    `${foreground} (${fg}) on ${background} (${bg}) is not measurable`,
  ).not.toBeNull();
  return measured;
}

it('resolved both themes — the token reader has not gone quiet', () => {
  for (const theme of THEMES) {
    expect(VALUES[theme].size, `${theme} resolved no tokens`).toBeGreaterThan(50);
  }
  // --bg is the one token guaranteed to differ between them.
  expect(VALUES.light.get('--bg')).not.toBe(VALUES.dark.get('--bg'));
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

    for (const theme of THEMES) {
      it(`${theme}: ${selector} draws ${text} on ${fill}`, () => {
        expect(Number(ratio(theme, text, fill).toFixed(2))).toBeGreaterThanOrEqual(4.5);
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
        VALUES.light.get(fill),
        `${fill} resolves to the same value in both themes, so it is a fixed fill ` +
          'under a themed foreground — the pair that inverts.',
      ).not.toBe(VALUES.dark.get(fill));
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
  for (const theme of THEMES) {
    it(`${theme}: ${mark} on ${circle}`, () => {
      expect(Number(ratio(theme, mark, circle).toFixed(2))).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme}: ${mark} also clears AA against the page`, () => {
      expect(Number(ratio(theme, mark, '--bg').toFixed(2))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('is not painted with the fill token the draft used', () => {
    expect(mark).not.toBe('--accent');
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

  for (const theme of THEMES) {
    it(`${theme}: caveat text ${text} on ${surface} clears 4.5:1 (SC 1.4.3)`, () => {
      expect(Number(ratio(theme, text, surface).toFixed(2))).toBeGreaterThanOrEqual(4.5);
    });

    /* The rule is the only thing marking the paragraph as a caution, which
       makes it a meaningful non-text graphic at 3:1 rather than decoration.
       --signal-500, which the draft used, is also base-scale and would not
       move with the theme at all. */
    it(`${theme}: the caution rule ${rule} on ${surface} clears 3:1 (SC 1.4.11)`, () => {
      expect(Number(ratio(theme, rule, surface).toFixed(2))).toBeGreaterThanOrEqual(3);
    });
  }
});

/* ------------------------------------------------------------------------ *
 * The streaming caret, measured for the same reason
 * ------------------------------------------------------------------------ */

describe('the streaming caret is visible as a state indicator, in both themes', () => {
  const fill = systemToken('ai/StreamingCaret.css', '.ds-streaming-caret', 'background');

  it('is not painted with the fill token the draft used', () => {
    expect(fill).not.toBe('--accent');
  });

  for (const theme of THEMES) {
    it(`${theme}: ${fill} on --bg clears 3:1 (SC 1.4.11)`, () => {
      expect(Number(ratio(theme, fill, '--bg').toFixed(2))).toBeGreaterThanOrEqual(3);
    });
  }
});
