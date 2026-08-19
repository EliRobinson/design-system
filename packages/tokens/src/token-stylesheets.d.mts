/** The token-declaring stylesheets, in cascade order (@imported files first). */
export declare const TOKEN_STYLESHEETS: string[];

/** This package's own `src/` directory. */
export declare const TOKENS_SRC_DIR: string;

/** Every token stylesheet's contents, in cascade order. */
export declare function readTokenStylesheets(srcDir?: string): string[];
