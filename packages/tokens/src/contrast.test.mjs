/* The gate. Every color token that carries meaning is measured against --bg in
 * both themes, and a token that does not clear its WCAG 2.2 AA threshold fails
 * this file — before it ever reaches a component, a consumer, or the mirror
 * into the Claude design project.
 *
 * This is the test that would have caught the bug it was written for: an
 * `<a class="ds-button ds-button--accent">` whose label went amber-on-amber at
 * 2.31:1 on hover. --link-hover was --signal-700 (5.86:1 against --bg, which
 * passes) painted over the --accent fill (2.31:1, which does not) because a
 * global `a:hover` outranked the variant. So two things are asserted here: the
 * per-token ratios against --bg, and the pairs — a fill and the foreground
 * drawn on it — that a per-token check alone cannot see.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from './color.mjs';
import { CONTRAST_RULES, THEMES, measureTokens, themeValues } from './contrast.mjs';

const srcDir = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(join(srcDir, 'tokens.css'), 'utf8');

const at = (theme) => themeValues(tokensCss, theme);
const themes = Object.fromEntries(THEMES.map((theme) => [theme, at(theme)]));

/** Ratio between two token names, resolved inside one theme. */
function ratio(theme, foreground, background) {
  const values = themes[theme];
  const fg = values.get(foreground);
  const bg = values.get(background);
  expect(fg, `${foreground} is not declared`).toBeDefined();
  expect(bg, `${background} is not declared`).toBeDefined();
  const result = contrastRatio(fg, bg);
  expect(result, `${foreground} (${fg}) on ${background} (${bg}) is not measurable`).not.toBeNull();
  return result;
}

describe('every meaningful color token clears its AA threshold against --bg', () => {
  for (const rule of CONTRAST_RULES) {
    const measured = measureTokens(tokensCss).filter((row) => row.label === rule.label);

    it(`covers ${rule.label} tokens in both themes`, () => {
      // A rule that matches nothing passes vacuously, which is the one way
      // this file could go quiet without anyone noticing.
      for (const theme of THEMES) {
        expect(
          measured.filter((row) => row.theme === theme).length,
          `no ${rule.label} tokens matched in ${theme}`,
        ).toBeGreaterThan(0);
      }
    });

    for (const row of measured) {
      it(`${row.theme}: ${row.name} >= ${rule.threshold}:1 (${rule.criterion})`, () => {
        expect(
          row.ratio,
          `${row.name} resolves to ${row.value}, which is not a color`,
        ).not.toBeNull();
        expect(
          Number(row.ratio.toFixed(2)),
          `${row.name} = ${row.value} is ${row.ratio.toFixed(2)}:1 against --bg`,
        ).toBeGreaterThanOrEqual(rule.threshold);
      });
    }
  }
});

/* A token can clear 4.5:1 against --bg and still be illegible where it is
   actually painted. These are the pairs the component library relies on. */
describe('foreground/fill pairs', () => {
  const PAIRS = [
    // The accent button through all three of its states — the reported bug.
    ['--accent-fg', '--accent', 4.5],
    ['--accent-fg', '--accent-hover', 4.5],
    ['--accent-fg', '--accent-press', 4.5],
    ['--anchor-fg', '--anchor', 4.5],
    // The brand tints, which only hold if the fill and its ink move together.
    ['--accent-ink', '--accent-tint', 4.5],
    ['--anchor-ink', '--anchor-tint', 4.5],
    ['--fg-inverse', '--bg-inverse', 4.5],
    ['--fg-on-signal', '--accent', 4.5],
    // Every surface the body text is drawn on.
    ['--fg', '--bg-subtle', 4.5],
    ['--fg', '--bg-muted', 4.5],
    ['--fg', '--surface', 4.5],
    ['--fg', '--surface-2', 4.5],
    ['--fg', '--surface-3', 4.5],
    ['--fg-2', '--surface', 4.5],
    /* Status text goes everywhere body text goes — a status cell in a zebra
       table, a nested card, an inset well — so it is measured everywhere body
       text is. Clearing 4.5:1 against --bg says nothing about --surface-3,
       and "the tint took it under AA" is the intuitive, wrong diagnosis for
       any status-color failure. These rows are what makes the claim in
       tokens.css ("clears 4.5:1 on every neutral surface") checkable. */
    ...[
      '--status-success-fg',
      '--status-warning-fg',
      '--status-danger-fg',
      '--status-info-fg',
    ].flatMap((fg) => [
      [fg, '--surface', 4.5],
      [fg, '--surface-2', 4.5],
      [fg, '--surface-3', 4.5],
      [fg, '--bg-subtle', 4.5],
      [fg, '--bg-muted', 4.5],
    ]),
  ];

  for (const theme of THEMES) {
    for (const [foreground, background, threshold] of PAIRS) {
      it(`${theme}: ${foreground} on ${background} >= ${threshold}:1`, () => {
        expect(Number(ratio(theme, foreground, background).toFixed(2))).toBeGreaterThanOrEqual(
          threshold,
        );
      });
    }
  }
});

describe('the focus ring is visible in both themes', () => {
  for (const theme of THEMES) {
    it(`${theme}: --focus-ring clears 3:1 against --bg and --surface`, () => {
      expect(ratio(theme, '--focus-ring', '--bg')).toBeGreaterThanOrEqual(3);
      expect(ratio(theme, '--focus-ring', '--surface')).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('the regression this file was written for', () => {
  it('no longer lets --link-hover land on the accent fill', () => {
    /* The measurement that failed: --signal-700 on --signal-500. It is kept as
       a literal because the point is the *pairing*, not the tokens' current
       values — both have since moved. */
    expect(contrastRatio('oklch(52% 0.145 45)', 'oklch(72.5% 0.175 65)')).toBeLessThan(4.5);
  });

  it('pins the fix: a link on a filled surface inherits the fill foreground', () => {
    expect(themes.light.get('--link-on-fill')).toBe('currentColor');
    expect(tokensCss).toMatch(/\.ds-button a[\s\S]*?color:\s*var\(--link-on-fill\)/);
    expect(tokensCss).toMatch(/\.ds-button a:hover[\s\S]*?color:\s*var\(--link-on-fill\)/);
  });
});

const STATES = ['success', 'warning', 'danger', 'info'];

describe('the fill/text split is real', () => {
  it('gives every --status-* fill a --status-*-fg and --status-*-tint partner', () => {
    for (const state of STATES) {
      expect(themes.light.get(`--status-${state}`), `--status-${state}`).toBeDefined();
      expect(themes.light.get(`--status-${state}-fg`), `--status-${state}-fg`).toBeDefined();
      expect(themes.light.get(`--status-${state}-tint`), `--status-${state}-tint`).toBeDefined();
    }
  });

  it('keeps the fill tokens that cannot carry text out of the text rule', () => {
    // If these ever clear 4.5:1 the split has quietly collapsed into one token
    // and the guidance in docs/agents/tokens.md is describing something else.
    expect(ratio('light', '--status-warning', '--bg')).toBeLessThan(4.5);
    expect(ratio('light', '--status-info', '--bg')).toBeLessThan(4.5);
  });
});

/* A tinted panel is the one construction where fill and text must move
   together. Alert paired a fixed pink with a themed --status-danger-fg and
   inverted to 2.40:1 in dark mode; measuring each token against --bg alone
   could never have seen it, because both cleared their own threshold. */
describe('every --status-*-tint carries its own --status-*-fg', () => {
  for (const theme of THEMES) {
    for (const state of STATES) {
      it(`${theme}: --status-${state}-fg on --status-${state}-tint >= 4.5:1`, () => {
        expect(
          Number(ratio(theme, `--status-${state}-fg`, `--status-${state}-tint`).toFixed(2)),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

/* The inverse pair is how a surface stays visible against either page: a
   fixed --ink-1000 tooltip, badge or button was 1.00:1 on a dark one. */
describe('the inverse pair flips with the theme', () => {
  for (const theme of THEMES) {
    it(`${theme}: --bg-inverse is legible against --bg, and --fg-inverse on it`, () => {
      expect(ratio(theme, '--bg-inverse', '--bg')).toBeGreaterThanOrEqual(3);
      expect(ratio(theme, '--fg-inverse', '--bg-inverse')).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('--accent-ink is the amber you can read', () => {
  for (const theme of THEMES) {
    it(`${theme}: --accent-ink clears 4.5:1 where --accent cannot`, () => {
      expect(ratio(theme, '--accent-ink', '--bg')).toBeGreaterThanOrEqual(4.5);
      expect(ratio(theme, '--accent-ink', '--surface')).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('light: --accent itself is fill-only, which is why the token exists', () => {
    expect(ratio('light', '--accent', '--bg')).toBeLessThan(3);
  });
});

describe('control edges are separable from decorative ones', () => {
  for (const theme of THEMES) {
    it(`${theme}: --border-control clears 3:1 where --border does not`, () => {
      expect(ratio(theme, '--border-control', '--bg')).toBeGreaterThanOrEqual(3);
      expect(ratio(theme, '--border-control', '--surface')).toBeGreaterThanOrEqual(3);
      expect(ratio(theme, '--border', '--bg')).toBeLessThan(3);
      expect(ratio(theme, '--border-strong', '--bg')).toBeLessThan(3);
    });
  }
});

describe('translucent tokens are measured as painted', () => {
  it('composites alpha over the background instead of reading it as opaque', () => {
    // Dark --border-control is oklch(100% 0 0 / 0.42). Read as opaque white it
    // would report 21:1 and this whole file would be measuring nothing.
    expect(themes.dark.get('--border-control')).toContain('/ 0.42');
    expect(ratio('dark', '--border-control', '--bg')).toBeLessThan(5);
  });
});
