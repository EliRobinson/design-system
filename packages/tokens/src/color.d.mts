export type Rgb = {
  /** gamma-encoded sRGB, 0–1 */
  r: number;
  g: number;
  b: number;
  /** 0–1; 1 for a value that declared no alpha */
  a: number;
};

export type AaVerdict = 'AA' | 'AA large only' | 'fails AA';

export type ContrastKind = 'text' | 'non-text';

export declare function parseColor(value: string): Rgb | null;

export declare function flattenCalc(value: string): string;

export declare function colorsIn(value: string): string[];

export declare function toHex(value: string): string | null;

export declare function contrastRatio(foreground: string, background: string): number | null;

export declare function aaVerdict(ratio: number, kind?: ContrastKind): AaVerdict;

export declare function srgbToLinear(channel: number): number;

export declare function linearSrgbToOklab(rgb: [number, number, number]): [number, number, number];
