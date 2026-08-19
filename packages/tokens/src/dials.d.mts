import type { Combination } from './contrast.d.mts';

/** One dial: the attribute that selects it, its values, and its default. */
export type Dial = {
  /** `palette` | `theme` | `platform` */
  name: string;
  /** e.g. `data-palette` */
  attribute: string;
  values: string[];
  /** the value you get by leaving the attribute off */
  default: string;
  /** one line on which token families move with this dial */
  owns: string;
};

/** A point on the three dials. Anything omitted is that dial's default. */
export type DialSelection = {
  palette?: string;
  theme?: string;
  platform?: string;
};

/** One token's value in one combination. */
export type CombinationValue = {
  /** `<palette>/<theme>` */
  combination: string;
  palette: string;
  theme: string;
  /** null when no block declares the token in this combination */
  value: string | null;
};

/** One token across every dial. */
export type TokenDial = {
  name: string;
  /** one entry per combination, in COMBINATIONS order, identical or not */
  values: CombinationValue[];
  /** true when the combinations do not all agree */
  varies: boolean;
  /** only the platforms that re-point this token */
  platforms: Array<{ platform: string; value: string }>;
};

export declare const PALETTES: string[];
export declare const THEMES: string[];
export declare const PLATFORMS: string[];
export declare const COMBINATIONS: Combination[];
export declare const DEFAULT_PALETTE: string;
export declare const DEFAULT_THEME: string;
export declare const DEFAULT_PLATFORM: string;
export declare const DIALS: Dial[];

export declare function dialNamed(name: string): Dial | undefined;

/** The root-element attributes selecting one point; defaults omitted. */
export declare function dialAttributes(selection?: DialSelection): Record<string, string>;

/** `dialAttributes` as markup — `''` for the default selection. */
export declare function dialAttributeString(selection?: DialSelection): string;

/** The palettes the supplied stylesheets declare token blocks for. */
export declare function declaredPalettes(css: string | string[]): string[];

/** The platforms the supplied stylesheets declare token blocks for. */
export declare function declaredPlatforms(css: string | string[]): string[];

/** Every custom property one platform re-points, in declaration order. */
export declare function platformOverrides(
  css: string | string[] | null,
  platform?: string,
): Array<{ name: string; value: string }>;

/** Which token names each dial moves, derived from the stylesheets. */
export declare function dialOwnership(
  sources: string[],
  platformCss?: string | string[] | null,
): { palette: string[]; theme: string[]; platform: string[] };

/** Every token's value in every combination, plus its platform overrides. */
export declare function tokenDials(
  sources: string[],
  options?: { platformCss?: string | string[] | null },
): TokenDial[];

/** `<default palette>/<default theme>`. */
export declare function defaultCombinationId(): string;

/** One entry's value in the default combination. */
export declare function defaultValueOf(entry: TokenDial): string | null;

export type { Combination };
