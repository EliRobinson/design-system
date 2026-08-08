/* Color math for the foundations pages: oklch (the tokens' native space) to
   sRGB, and WCAG 2.x contrast ratios. Hand-rolled from the OKLab reference
   math (bottosson.github.io/posts/oklab) so the docs can compute honest AA
   verdicts from live token values — verified against the brand README's
   published amber-on-ink checksum in color.test.ts. */

export type Rgb = { r: number; g: number; b: number };

function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
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

function gamma(channel: number): number {
  const c = Math.min(1, Math.max(0, channel));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

const OKLCH_PATTERN = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)/;

/** Parse an oklch(...) or #rrggbb token value into gamma-encoded sRGB (0–1). */
export function parseColor(value: string): Rgb | null {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16) / 255,
      g: parseInt(hex[1].slice(2, 4), 16) / 255,
      b: parseInt(hex[1].slice(4, 6), 16) / 255,
    };
  }
  const oklch = value.match(OKLCH_PATTERN);
  if (oklch) {
    const linear = oklchToLinearSrgb(Number(oklch[1]) / 100, Number(oklch[2]), Number(oklch[3]));
    return { r: gamma(linear.r), g: gamma(linear.g), b: gamma(linear.b) };
  }
  return null;
}

export function toHex(value: string): string | null {
  const rgb = parseColor(value);
  if (!rgb) {
    return null;
  }
  const channel = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio between two token values (oklch or hex). */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) {
    return null;
  }
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

export type AaVerdict = 'AA' | 'AA large only' | 'fails AA';

export function aaVerdict(ratio: number): AaVerdict {
  if (ratio >= 4.5) {
    return 'AA';
  }
  if (ratio >= 3) {
    return 'AA large only';
  }
  return 'fails AA';
}
