import type { TokenEntry } from './parse-tokens-css.d.mts';

export type Combination = {
  /** e.g. `ember` */
  palette: string;
  /** `light` or `dark` */
  theme: string;
  /** `<palette>/<theme>`, the name a test failure reports */
  id: string;
};

export type ContrastRule = {
  label: string;
  threshold: number;
  criterion: string;
  match: RegExp;
  /** token name -> the reason it is deliberately outside this rule */
  except: Record<string, string>;
};

export type Measurement = {
  palette: string;
  theme: string;
  combination: string;
  name: string;
  label: string;
  criterion: string;
  threshold: number;
  value: string;
  ratio: number | null;
};

export declare const PALETTES: string[];
export declare const THEMES: string[];
export declare const COMBINATIONS: Combination[];
export declare const DEFAULT_PALETTE: string;
export declare const CONTRAST_RULES: ContrastRule[];

/** Selectors declaring tokens that no combination resolves — always empty, or a bug. */
export declare function unreadableSelectors(sources: string[]): string[];

/** Every token's concrete value in one palette x theme, `var()` chains followed. */
export declare function combinationValues(
  sources: string[],
  combination: { palette: string; theme: string },
): Map<string, string>;

/** `combinationValues` for one theme under the default palette. */
export declare function themeValues(
  sources: string | string[],
  theme: 'light' | 'dark',
): Map<string, string>;

/** Run CONTRAST_RULES over every palette x theme. */
export declare function measureTokens(sources: string[]): Measurement[];

export type { TokenEntry };
