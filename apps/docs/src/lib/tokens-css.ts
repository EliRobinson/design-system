/* Reads token names, values, and their inline comments straight out of the
   published tokens.css, so the foundations pages render whatever the package
   ships today — they cannot drift from it. Server-side only.

   The parsing itself is @elirobinson/tokens' job; this module is the file
   reader and the query helpers on top of it. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseTokensCss, type TokenEntry } from '@elirobinson/tokens/parse-tokens-css';

/* Resolved through the workspace symlink rather than require.resolve — the
   bundler would otherwise try to treat the CSS file as an importable module
   asset. The exports map pins ./tokens.css to ./src/tokens.css, so this path
   is the same file a consumer gets. */
const TOKENS_CSS_PATH = join(process.cwd(), 'node_modules/@elirobinson/tokens/src/tokens.css');

export type { TokenEntry };

let cache: TokenEntry[] | null = null;

export function cssTokens(): TokenEntry[] {
  cache ??= parseTokensCss(readFileSync(TOKENS_CSS_PATH, 'utf8'));
  return cache;
}

export function tokensByPrefix(prefix: string): TokenEntry[] {
  return cssTokens().filter((t) => t.name.startsWith(`--${prefix}-`));
}

/* Last declaration wins, as in CSS — --status-success/--status-warning are
   declared in the base scale and then re-pointed at brand colors in the
   semantic section. */
export function getToken(name: string): TokenEntry | undefined {
  const matches = cssTokens().filter((t) => t.name === name);
  return matches[matches.length - 1];
}
