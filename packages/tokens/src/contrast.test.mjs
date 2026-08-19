/* The gate. Every color token that carries meaning is measured against --bg in
 * every palette × theme, and a token that does not clear its WCAG 2.2 AA
 * threshold fails this file — before it ever reaches a component, a consumer,
 * or the mirror into the Claude design project.
 *
 * This is the test that would have caught the bug it was written for: an
 * `<a class="ds-button ds-button--accent">` whose label went amber-on-amber at
 * 2.31:1 on hover. --link-hover was --signal-700 (5.86:1 against --bg, which
 * passes) painted over the --accent fill (2.31:1, which does not) because a
 * global `a:hover` outranked the variant. So two things are asserted here: the
 * per-token ratios against --bg, and the pairs — a fill and the foreground
 * drawn on it — that a per-token check alone cannot see.
 *
 * It used to sweep two themes of one stylesheet. Two of the tokens it now
 * measures — --accent-tint and --anchor-tint — were near-whites left
 * un-inverted in dark mode, and each one passed its own threshold against
 * --bg the whole time. A sweep is only as wide as the combinations it walks,
 * so it walks all four.
 */

import { describe, expect, it } from 'vitest';

import { contrastRatio } from './color.mjs';
import {
  COMBINATIONS,
  CONTRAST_RULES,
  PALETTES,
  THEMES,
  combinationValues,
  measureTokens,
  unreadableSelectors,
} from './contrast.mjs';
import { readTokenStylesheets } from './token-stylesheets.mjs';

const sources = readTokenStylesheets();
const resolved = new Map(COMBINATIONS.map((c) => [c.id, combinationValues(sources, c)]));

/** Ratio between two token names, resolved inside one combination. */
function ratio(combination, foreground, background) {
  const values = resolved.get(combination);
  const fg = values.get(foreground);
  const bg = values.get(background);
  expect(fg, `${foreground} is not declared in ${combination}`).toBeDefined();
  expect(bg, `${background} is not declared in ${combination}`).toBeDefined();
  const result = contrastRatio(fg, bg);
  expect(
    result,
    `${foreground} (${fg}) on ${background} (${bg}) is not measurable in ${combination}`,
  ).not.toBeNull();
  return result;
}

/* The neutral ramp's central claim: a palette may move `--n-h` and `--n-mult`
   freely because neither touches lightness, and lightness is what carries
   contrast. Asserted as a tolerance rather than as equality, and the tolerance
   is measured, not chosen — chroma is not perfectly luminance-neutral in sRGB,
   so multiplying it by 1.6 at 12% lightness shifts the composite luminance in
   the fourth decimal. Across every neutral foreground on every neutral surface
   in both themes the largest disagreement between ember and slate is 0.003:1.
   Rounding to two places is what breaks — `--border-control` on dark
   `--bg-muted` is 4.0033 under one palette and 4.0004 under the other, which
   round to 4.01 and 4.00 and look like a change.
 
   0.01 is therefore three times the observed spread and two orders of
   magnitude below the gap between any two WCAG thresholds, so a real move —
   a palette that tinted a grey by touching its lightness — still fails here. */
const PALETTE_TOLERANCE = 0.01;

function expectPaletteIndependent(label, theme, measure) {
  const ratios = PALETTES.map((palette) => measure(`${palette}/${theme}`));
  const spread = Math.max(...ratios) - Math.min(...ratios);
  expect(
    spread,
    `${label} moved with the palette in ${theme}: ${ratios.map((r) => r.toFixed(4)).join(' vs ')}`,
  ).toBeLessThanOrEqual(PALETTE_TOLERANCE);
}

/* Before any threshold: the sweep has to be walking what it thinks it is.
   Each of these is a way the file could go quiet while still passing. */
describe('the sweep covers the whole vocabulary', () => {
  it('walks four combinations, not two themes', () => {
    expect(PALETTES.length).toBeGreaterThan(1);
    expect(COMBINATIONS.map((c) => c.id)).toEqual([
      'ember/light',
      'ember/dark',
      'slate/light',
      'slate/dark',
    ]);
  });

  it('reads every stylesheet that declares a token', () => {
    // palettes.css and tokens.css. A third file added to TOKEN_STYLESHEETS
    // arrives here for free; one added to the CSS and not to that list does
    // not, which is what this asserts is not currently the case.
    expect(sources.length).toBe(2);
    expect(sources.some((css) => css.includes("[data-palette='slate']"))).toBe(true);
  });

  it('understands every selector a token is declared under', () => {
    /* A `[data-palette='forest']` block added without a matching entry in
       SELECTOR_PARTS would resolve under no combination at all — every token
       in it silently unmeasured, which is exactly how the un-inverted tints
       survived a passing test suite. */
    expect(unreadableSelectors(sources)).toEqual([]);
  });

  it('resolves every token to a concrete value in every combination', () => {
    for (const { id } of COMBINATIONS) {
      const dangling = [...resolved.get(id)]
        .filter(([, value]) => value.includes('var(') && !value.includes('--ds-font-'))
        .map(([name]) => name);
      expect(dangling, `${id} leaves these unresolved`).toEqual([]);
    }
  });
});

describe('every meaningful color token clears its AA threshold against --bg', () => {
  const measured = measureTokens(sources);

  for (const rule of CONTRAST_RULES) {
    const rows = measured.filter((row) => row.label === rule.label);

    it(`covers ${rule.label} tokens in every combination`, () => {
      // A rule that matches nothing passes vacuously, which is the one way
      // this file could go quiet without anyone noticing.
      for (const { id } of COMBINATIONS) {
        expect(
          rows.filter((row) => row.combination === id).length,
          `no ${rule.label} tokens matched in ${id}`,
        ).toBeGreaterThan(0);
      }
    });

    for (const row of rows) {
      it(`${row.combination}: ${row.name} >= ${rule.threshold}:1 (${rule.criterion})`, () => {
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
  const STATES = ['success', 'warning', 'danger', 'info'];

  const PAIRS = [
    // The accent button through all three of its states — the reported bug.
    // Which way hover moves is the palette's business; that the label stays
    // readable through all three is not.
    ['--accent-fg', '--accent', 4.5],
    ['--accent-fg', '--accent-hover', 4.5],
    ['--accent-fg', '--accent-press', 4.5],
    ['--anchor-fg', '--anchor', 4.5],
    ['--anchor-fg', '--anchor-hover', 4.5],
    ['--anchor-fg', '--anchor-press', 4.5],
    // The brand tints, which only hold if the fill and its ink move together.
    ['--accent-ink', '--accent-tint', 4.5],
    ['--anchor-ink', '--anchor-tint', 4.5],
    ['--fg-inverse', '--bg-inverse', 4.5],
    /* The muted foregrounds on an inverted band. Without these the band only
       had a primary text token, and everything secondary on it used a fixed
       ramp step that stayed put while the band flipped — 1.53:1 in dark. */
    ['--fg-inverse-2', '--bg-inverse', 4.5],
    ['--fg-inverse-3', '--bg-inverse', 4.5],
    ['--accent-ink-inverse', '--bg-inverse', 4.5],
    ['--fg-on-signal', '--accent', 4.5],
    // Every surface the body text is drawn on.
    ['--fg', '--bg-subtle', 4.5],
    ['--fg', '--bg-muted', 4.5],
    ['--fg', '--surface', 4.5],
    ['--fg', '--surface-2', 4.5],
    ['--fg', '--surface-3', 4.5],
    ['--fg-2', '--surface', 4.5],
    /* The fifth member of each status set. `--status-X-on` is the only token
       whose entire job is to be readable on a specific fill, so it is the one
       token a --bg sweep says nothing at all about — and warning's is ink
       while the other three are white, which is exactly the kind of asymmetry
       a component gets wrong by hand. */
    ...STATES.map((state) => [`--status-${state}-on`, `--status-${state}`, 4.5]),
    /* Status text goes everywhere body text goes — a status cell in a zebra
       table, a nested card, an inset well — so it is measured everywhere body
       text is. Clearing 4.5:1 against --bg says nothing about --surface-3,
       and "the tint took it under AA" is the intuitive, wrong diagnosis for
       any status-color failure. */
    ...STATES.map((state) => `--status-${state}-fg`).flatMap((fg) => [
      [fg, '--surface', 4.5],
      [fg, '--surface-2', 4.5],
      [fg, '--surface-3', 4.5],
      [fg, '--bg-subtle', 4.5],
      [fg, '--bg-muted', 4.5],
    ]),
  ];

  for (const { id } of COMBINATIONS) {
    for (const [foreground, background, threshold] of PAIRS) {
      it(`${id}: ${foreground} on ${background} >= ${threshold}:1`, () => {
        expect(Number(ratio(id, foreground, background).toFixed(2))).toBeGreaterThanOrEqual(
          threshold,
        );
      });
    }
  }
});

describe('the focus ring is visible in every combination', () => {
  for (const { id } of COMBINATIONS) {
    it(`${id}: --focus-ring clears 3:1 against --bg and --surface`, () => {
      expect(ratio(id, '--focus-ring', '--bg')).toBeGreaterThanOrEqual(3);
      expect(ratio(id, '--focus-ring', '--surface')).toBeGreaterThanOrEqual(3);
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
    const [, tokensCss] = sources;
    expect(resolved.get('ember/light').get('--link-on-fill')).toBe('currentColor');
    expect(tokensCss).toMatch(/\.ds-button a[\s\S]*?color:\s*var\(--link-on-fill\)/);
    expect(tokensCss).toMatch(/\.ds-button a:hover[\s\S]*?color:\s*var\(--link-on-fill\)/);
  });
});

const STATES = ['success', 'warning', 'danger', 'info'];

describe('the fill/text split is real', () => {
  it('gives every --status-* fill its four partners', () => {
    const values = resolved.get('ember/light');
    for (const state of STATES) {
      for (const suffix of ['', '-on', '-fg', '-tint', '-tint-edge']) {
        expect(
          values.get(`--status-${state}${suffix}`),
          `--status-${state}${suffix}`,
        ).toBeDefined();
      }
    }
  });

  it('keeps the fill token that cannot carry text out of the text rule', () => {
    // If warning ever clears 4.5:1 the split has quietly collapsed into one
    // token and the guidance in docs/agents/tokens.md describes something else.
    expect(ratio('ember/light', '--status-warning', '--bg')).toBeLessThan(4.5);
  });

  it('makes --status-warning-border carry the floor --status-warning cannot', () => {
    /* The documented exception, asserted from both sides so neither half can
       drift: the fill is under 3:1 and the border that must edge it is over.
       This is the pair `CONTRAST_RULES` records an exemption for. */
    for (const { id } of COMBINATIONS) {
      expect(ratio(id, '--status-warning-border', '--bg')).toBeGreaterThanOrEqual(3);
    }
    expect(ratio('ember/light', '--status-warning', '--bg')).toBeLessThan(3);
    expect(ratio('slate/light', '--status-warning', '--bg')).toBeLessThan(3);
  });
});

/* A tinted panel is the one construction where fill and text must move
   together. Alert paired a fixed pink with a themed --status-danger-fg and
   inverted to 2.40:1 in dark mode; measuring each token against --bg alone
   could never have seen it, because both cleared their own threshold. */
describe('every --status-*-tint carries its own --status-*-fg', () => {
  for (const { id } of COMBINATIONS) {
    for (const state of STATES) {
      it(`${id}: --status-${state}-fg on --status-${state}-tint >= 4.5:1`, () => {
        expect(
          Number(ratio(id, `--status-${state}-fg`, `--status-${state}-tint`).toFixed(2)),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

/* The point of the split. Status and chart are declared once, under `:root`
   and the theme block, and no `[data-palette]` block touches them — so a
   caution badge is the same yellow whichever brand is mounted. Asserting the
   values are equal across palettes is what stops a future palette "helpfully"
   tinting them to match its accent, which is the bug the split undid. */
describe('status and data colours do not move with the palette', () => {
  const paletteIndependent = [
    ...STATES.flatMap((state) => [
      `--status-${state}`,
      `--status-${state}-on`,
      `--status-${state}-fg`,
      `--status-${state}-tint`,
      `--status-${state}-tint-edge`,
    ]),
    '--status-warning-border',
    ...Array.from({ length: 8 }, (_, i) => `--chart-${i + 1}`),
  ];

  for (const theme of THEMES) {
    for (const name of paletteIndependent) {
      it(`${theme}: ${name} is the same under every palette`, () => {
        const values = PALETTES.map((palette) => resolved.get(`${palette}/${theme}`).get(name));
        expect(values[0], `${name} is not declared`).toBeDefined();
        expect(
          new Set(values).size,
          `${name} differs across palettes: ${values.join(' vs ')}`,
        ).toBe(1);
      });
    }
  }

  it('is measuring something that CAN move — the brand does', () => {
    // Without this the assertion above would also pass on a stylesheet where
    // nothing at all varies with data-palette.
    expect(resolved.get('ember/light').get('--accent')).not.toBe(
      resolved.get('slate/light').get('--accent'),
    );
  });
});

/* The neutral ramp is mixed from two palette-owned dials, and the claim that
   buys — a palette may tint the greys freely — only holds because neither dial
   touches lightness. Measured rather than asserted in prose. */
describe('the neutral dial moves hue and chroma without moving contrast', () => {
  const NEUTRALS = ['--fg-2', '--fg-3', '--fg-4', '--fg-disabled', '--border-control'];

  for (const theme of THEMES) {
    it(`${theme}: every neutral measures the same under both palettes`, () => {
      for (const name of NEUTRALS) {
        expectPaletteIndependent(name, theme, (id) => ratio(id, name, '--bg'));
      }
    });
  }

  it('is measuring something that CAN move — the greys are tinted', () => {
    expect(resolved.get('ember/light').get('--ink-600')).not.toBe(
      resolved.get('slate/light').get('--ink-600'),
    );
  });
});

/* The inverse pair is how a surface stays visible against either page: a
   fixed --ink-1000 tooltip, badge or button was 1.00:1 on a dark one. */
describe('the inverse pair flips with the theme', () => {
  for (const { id } of COMBINATIONS) {
    it(`${id}: --bg-inverse is legible against --bg, and --fg-inverse on it`, () => {
      expect(ratio(id, '--bg-inverse', '--bg')).toBeGreaterThanOrEqual(3);
      expect(ratio(id, '--fg-inverse', '--bg-inverse')).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('--accent-ink is the brand colour you can read', () => {
  for (const { id } of COMBINATIONS) {
    it(`${id}: --accent-ink clears 4.5:1 on --bg and --surface`, () => {
      expect(ratio(id, '--accent-ink', '--bg')).toBeGreaterThanOrEqual(4.5);
      expect(ratio(id, '--accent-ink', '--surface')).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('ember/light: --accent itself is fill-only, which is why the token exists', () => {
    /* Only ember's amber is; slate's teal accent clears 5.11:1. That the two
       differ is the reason --accent-ink exists as a separate token rather than
       as advice about which step to use. */
    expect(ratio('ember/light', '--accent', '--bg')).toBeLessThan(3);
  });
});

describe('control edges are separable from decorative ones', () => {
  /* An input sits on whatever surface the layout put it on, and a control edge
     is a meaningful non-text graphic wherever it is drawn — so 3:1 against --bg
     is not the claim, 3:1 against every neutral surface is. The narrowest is
     --bg-muted / --surface-3, the two darkest light-mode surfaces, at 3.26:1;
     clearing --bg at 3.64:1 says nothing about them.

     Every one of these figures holds under both palettes, which is the neutral
     dial's whole promise made checkable: --border-control is mixed from
     --n-mult and --n-h like the ramp it belongs to, and slate multiplies its
     chroma by 1.6 without moving any of them by more than 0.003:1. Lightness
     carries contrast; chroma does not. See PALETTE_TOLERANCE for why that
     residue is not zero. */
  const NEUTRAL_SURFACES = [
    '--bg',
    '--bg-subtle',
    '--bg-muted',
    '--surface',
    '--surface-2',
    '--surface-3',
  ];

  for (const { id } of COMBINATIONS) {
    for (const surface of NEUTRAL_SURFACES) {
      it(`${id}: --border-control >= 3:1 on ${surface} (SC 1.4.11)`, () => {
        expect(Number(ratio(id, '--border-control', surface).toFixed(2))).toBeGreaterThanOrEqual(3);
      });
    }

    it(`${id}: --border and --border-strong stay decorative`, () => {
      expect(ratio(id, '--border', '--bg')).toBeLessThan(3);
      expect(ratio(id, '--border-strong', '--bg')).toBeLessThan(3);
    });
  }

  it('measures the same edge under every palette', () => {
    for (const theme of THEMES) {
      for (const surface of NEUTRAL_SURFACES) {
        expectPaletteIndependent(`--border-control on ${surface}`, theme, (id) =>
          ratio(id, '--border-control', surface),
        );
      }
    }
  });
});

/* Eight categorical hues at one lightness and one chroma. The floor is the
   3:1 of a non-text graphic, and the spread is the other half of the claim:
   a scale whose members differ in contrast reads as an ordering. */
describe('the data ramp is flat', () => {
  for (const { id } of COMBINATIONS) {
    it(`${id}: every --chart-* clears 3:1 and none dominates`, () => {
      const ratios = Array.from({ length: 8 }, (_, i) => ratio(id, `--chart-${i + 1}`, '--bg'));
      for (const value of ratios) expect(value).toBeGreaterThanOrEqual(3);
      expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(1.5);
    });
  }

  for (const { id, theme } of COMBINATIONS) {
    if (theme !== 'dark') continue;
    it(`${id}: a dark chart may label a series in its own colour`, () => {
      for (let i = 1; i <= 8; i += 1) {
        expect(ratio(id, `--chart-${i}`, '--bg')).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe('translucent tokens are measured as painted', () => {
  it('composites alpha over the background instead of reading it as opaque', () => {
    // Dark --border-control is oklch(100% 0 0 / 0.42). Read as opaque white it
    // would report 21:1 and this whole file would be measuring nothing.
    expect(resolved.get('ember/dark').get('--border-control')).toContain('/ 0.42');
    expect(ratio('ember/dark', '--border-control', '--bg')).toBeLessThan(5);
  });
});
