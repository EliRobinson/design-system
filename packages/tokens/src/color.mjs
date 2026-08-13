/* The one color parser.
 *
 * oklch (the tokens' native space) to sRGB, and WCAG 2.x contrast ratios.
 * Hand-rolled from the OKLab reference math (bottosson.github.io/posts/oklab)
 * and verified in color.test.mjs against the brand README's published
 * amber-on-ink checksum.
 *
 * This lives in @elirobinson/tokens rather than in the docs app because two
 * things now need it: the foundations pages, which render honest AA verdicts
 * from live token values, and contrast.test.mjs, which is the gate that stops
 * a failing color reaching the stylesheet at all. A second copy is how the
 * gate and the docs would come to disagree about whether a token passes.
 *
 * Authored as .mjs to match parse-tokens-css.mjs: it has to run under plain
 * node from test and build scripts as well as being importable from
 * TypeScript. Types live in color.d.mts.
 */

/** @typedef {{r: number, g: number, b: number, a: number}} Rgb */

function oklchToLinearSrgb(l, c, hDeg) {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    g: -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    b: -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  };
}

function gamma(channel) {
  const c = Math.min(1, Math.max(0, channel));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

const OKLCH_PATTERN = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/;

/**
 * Parse an `oklch(...)` or `#rrggbb` token value into gamma-encoded sRGB (0–1)
 * plus its alpha. Alpha is carried, not dropped: `--border-control` in dark
 * mode is `oklch(100% 0 0 / 0.42)`, and reading that as opaque white reports
 * 21:1 for an edge that actually renders at 3.95:1.
 *
 * @param {string} value
 * @returns {Rgb | null}
 */
export function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16) / 255,
      g: parseInt(hex[1].slice(2, 4), 16) / 255,
      b: parseInt(hex[1].slice(4, 6), 16) / 255,
      a: 1,
    };
  }
  const oklch = value.match(OKLCH_PATTERN);
  if (oklch) {
    const linear = oklchToLinearSrgb(Number(oklch[1]) / 100, Number(oklch[2]), Number(oklch[3]));
    return {
      r: gamma(linear.r),
      g: gamma(linear.g),
      b: gamma(linear.b),
      a: parseAlpha(oklch[4]),
    };
  }
  return null;
}

function parseAlpha(raw) {
  if (raw === undefined) return 1;
  return raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
}

/**
 * A token value as hex, alpha discarded — this is the swatch a reader sees
 * named, not the composite. Use `contrastRatio` for anything measured.
 *
 * @param {string} value
 * @returns {string | null}
 */
export function toHex(value) {
  const rgb = parseColor(value);
  if (!rgb) {
    return null;
  }
  const channel = (c) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

/** Source-over composite of a translucent color onto an opaque one. */
function composite(fg, bg) {
  if (fg.a >= 1) return fg;
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function relativeLuminance({ r, g, b }) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * WCAG 2.x contrast ratio between two token values (oklch or hex).
 *
 * A translucent foreground is composited over the background first, which is
 * what a browser paints. The background is taken as opaque; a translucent one
 * has no defined ratio without knowing what is behind it.
 *
 * @param {string} foreground
 * @param {string} background
 * @returns {number | null} null if either value is not a color this can parse
 */
export function contrastRatio(foreground, background) {
  const bg = parseColor(background);
  const parsedFg = parseColor(foreground);
  if (!parsedFg || !bg) {
    return null;
  }
  const fg = composite(parsedFg, bg);
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

/** @typedef {'AA' | 'AA large only' | 'fails AA'} AaVerdict */

/**
 * @param {number} ratio
 * @returns {AaVerdict}
 */
export function aaVerdict(ratio) {
  if (ratio >= 4.5) {
    return 'AA';
  }
  if (ratio >= 3) {
    return 'AA large only';
  }
  return 'fails AA';
}
