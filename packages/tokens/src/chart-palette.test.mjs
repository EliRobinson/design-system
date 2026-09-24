/* The chart ramp, held to the dataviz palette validator.
 *
 * contrast.test.mjs proves each --chart-* clears 3:1 against --bg. That says a
 * series is visible, not that two series can be told apart, and the palette
 * shipped for months passing it while two of its slots collapsed for a
 * deuteranope: --chart-1 (hue 25) and --chart-3 (hue 115) were ΔE 5.0 apart in
 * light and 4.6 in dark under simulated deuteranopia (#252, from
 * fantasy-gbbo#85). Its dark values also sat at OKLCH L 0.74, above the band
 * where a series keeps its saturation.
 *
 * The checks and thresholds are the dataviz skill's `validate_palette.js`,
 * restated here so the build runs them:
 *
 *   - lightness band: OKLCH L in 0.43–0.77 light, 0.48–0.67 dark
 *   - chroma floor: OKLCH C >= 0.10, below which a hue reads as grey
 *   - colour-blind separation: OKLab ΔE ×100 >= 8 under the Machado, Oliveira
 *     & Fernandes (2009) severity-1.0 protan and deutan transforms, for every
 *     adjacent pair (a line or stacked chart only puts neighbours together)
 *     and for every pair among the first three slots (a chart of three lines
 *     puts all three together)
 *   - normal-vision floor: ΔE >= 15 on the same pairs, unsimulated
 *
 * The validator measures 8-bit hex, so this does too: each value goes through
 * toHex before any of the maths, which is also what a browser paints.
 */

import { describe, expect, it } from 'vitest';

import { linearSrgbToOklab, parseColor, srgbToLinear, toHex } from './color.mjs';
import { COMBINATIONS, combinationValues } from './contrast.mjs';
import { readTokenStylesheets } from './token-stylesheets.mjs';

const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
const CHROMA_FLOOR = 0.1;
const CVD_TARGET = 8;
const NORMAL_FLOOR = 15;
const MIN_HUE_STEP = 90;

/* Machado, Oliveira & Fernandes (2009), severity 1.0, applied to linear sRGB.
   The validator's thresholds are calibrated to this model; a different
   simulation moves the borderline pairs. */
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

const clamp = (c) => Math.min(1, Math.max(0, c));

/** Linear sRGB of a token value, quantised to 8 bits the way it is painted. */
function linearRgb(value) {
  const hex = toHex(value ?? '');
  expect(hex, `${value} is not a measurable colour`).not.toBeNull();
  const { r, g, b } = parseColor(hex);
  return [r, g, b].map(srgbToLinear);
}

const oklab = (value) => linearSrgbToOklab(linearRgb(value));

function simulate(rgb, kind) {
  if (!kind) return rgb;
  return MACHADO[kind].map((row) => clamp(row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]));
}

/** OKLab distance ×100 between two token values, optionally as a dichromat sees them. */
function deltaE(first, second, kind) {
  const a = linearSrgbToOklab(simulate(linearRgb(first), kind));
  const b = linearSrgbToOklab(simulate(linearRgb(second), kind));
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const sources = readTokenStylesheets();

/** The declared `--chart-N` series of one combination, in slot order. */
function chartSeries(values) {
  return [...values.keys()]
    .map((name) => name.match(/^--chart-(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b)
    .map((slot) => values.get(`--chart-${slot}`));
}

/** `oklch(62% 0.13 10)` as the three numbers it was authored with. */
function authored(value) {
  const match = value.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  expect(match, `${value} is not a plain oklch() declaration`).not.toBeNull();
  return match.slice(1).map(Number);
}

describe('the chart ramp passes the dataviz palette validator', () => {
  for (const combination of COMBINATIONS) {
    const series = chartSeries(combinationValues(sources, combination));
    const { id, theme } = combination;
    /* Adjacent slots, then the one pair among the first three that is not
       already adjacent — 1↔3, the pair #252 was filed for. */
    const PAIRS = [...series.slice(1).map((_, i) => [i + 1, i + 2]), [1, 3]];

    it(`${id}: declares the eight series`, () => {
      expect(series).toHaveLength(8);
    });

    it(`${id}: every series shares one lightness and one chroma`, () => {
      const [first, ...rest] = series.map(authored);
      for (const [L, C] of rest) expect([L, C]).toEqual(first.slice(0, 2));
    });

    it(`${id}: consecutive series are at least ${MIN_HUE_STEP}° apart in hue`, () => {
      const hues = series.map((value) => authored(value)[2]);
      hues.slice(1).forEach((hue, i) => {
        const step = Math.abs(hue - hues[i]) % 360;
        expect(
          Math.min(step, 360 - step),
          `--chart-${i + 1} → --chart-${i + 2}`,
        ).toBeGreaterThanOrEqual(MIN_HUE_STEP);
      });
    });

    it(`${id}: every --chart-* sits inside the ${theme} lightness band and above the chroma floor`, () => {
      const [lo, hi] = BAND[theme];
      series.forEach((value, i) => {
        const [L, a, b] = oklab(value);
        expect(L, `--chart-${i + 1} (${value}) L ${L.toFixed(3)}`).toBeGreaterThanOrEqual(lo);
        expect(L, `--chart-${i + 1} (${value}) L ${L.toFixed(3)}`).toBeLessThanOrEqual(hi);
        expect(Math.hypot(a, b), `--chart-${i + 1} (${value}) chroma`).toBeGreaterThanOrEqual(
          CHROMA_FLOOR,
        );
      });
    });

    for (const [i, j] of PAIRS) {
      it(`${id}: --chart-${i} and --chart-${j} stay apart for protan and deutan readers`, () => {
        for (const kind of ['protan', 'deutan']) {
          const measured = deltaE(series[i - 1], series[j - 1], kind);
          expect(measured, `${kind} ΔE ${measured.toFixed(1)}`).toBeGreaterThanOrEqual(CVD_TARGET);
        }
      });

      it(`${id}: --chart-${i} and --chart-${j} stay apart with full colour vision`, () => {
        const measured = deltaE(series[i - 1], series[j - 1]);
        expect(measured, `ΔE ${measured.toFixed(1)}`).toBeGreaterThanOrEqual(NORMAL_FLOOR);
      });
    }
  }

  /* The maths is restated rather than imported, so pin it to the numbers the
     validator itself printed for the palette this file was written against.
     If the simulation drifted, every assertion above could pass or fail for
     the wrong reason. */
  it('reproduces the validator on the pair #252 was filed for', () => {
    expect(deltaE('oklch(62% 0.13 25)', 'oklch(62% 0.13 115)', 'deutan')).toBeCloseTo(4.98, 1);
    expect(deltaE('oklch(74% 0.12 25)', 'oklch(74% 0.12 115)', 'deutan')).toBeCloseTo(4.59, 1);
  });
});
