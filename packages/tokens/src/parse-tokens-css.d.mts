export type TokenEntry = {
  /** e.g. `--ink-500` */
  name: string;
  /** raw declared value, may be a `var(--…)` reference */
  value: string;
  /** `var()` chains followed to a concrete value */
  resolved: string;
  /** the trailing `/* … *\/` comment on the declaration, if any */
  comment: string | null;
};

export declare function parseTokensCss(css: string): TokenEntry[];

export declare function effectiveTokens(tokens: TokenEntry[]): Map<string, TokenEntry>;
