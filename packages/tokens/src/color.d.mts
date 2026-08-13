export type Rgb = {
  /** gamma-encoded sRGB, 0–1 */
  r: number;
  g: number;
  b: number;
  /** 0–1; 1 for a value that declared no alpha */
  a: number;
};

export type AaVerdict = 'AA' | 'AA large only' | 'fails AA';

export declare function parseColor(value: string): Rgb | null;

export declare function toHex(value: string): string | null;

export declare function contrastRatio(foreground: string, background: string): number | null;

export declare function aaVerdict(ratio: number): AaVerdict;
