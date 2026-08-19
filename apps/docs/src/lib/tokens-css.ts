/* Reads token names, values, and their inline comments straight out of the
   published token stylesheets, so the foundations pages render whatever the
   package ships today — they cannot drift from it. Server-side only.

   The parsing itself is @elirobinson/tokens' job; this module is the file
   reader and the query helpers on top of it. */

import { parseTokensCss, type TokenEntry } from '@elirobinson/tokens/parse-tokens-css';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';

export type { TokenEntry };

let cache: TokenEntry[] | null = null;

/* Every stylesheet that declares tokens, in cascade order, from the package
   itself. This used to be one hardcoded path to tokens.css, which the palette
   split turned into a silent lie: tokens.css alone still parses and still
   returns a couple of hundred declarations, minus the entire brand — no
   --accent-fg, no --signal-*, and `--fg-on-signal: var(--accent-fg)` resolving
   to itself. Every foundations page reads through here, so all of them went
   greyscale at once and none of them threw.

   `readTokenStylesheets()` defaults to the package's own src/, derived from
   `import.meta.url`. That is a bundler-sensitive thing to rely on, so it was
   checked rather than assumed: under `next build` (Turbopack) it resolves to
   packages/tokens/src through the workspace symlink, and under vitest it runs
   unbundled. If it ever stops resolving, readFileSync throws at build time
   naming the missing file — loud, and never a page rendered without a brand. */
export function cssTokens(): TokenEntry[] {
  cache ??= parseTokensCss(readTokenStylesheets());
  return cache;
}

export function tokensByPrefix(prefix: string): TokenEntry[] {
  return cssTokens().filter((t) => t.name.startsWith(`--${prefix}-`));
}

/* Last declaration wins, as in CSS. The palette layer is read first, so a name
   it declares and tokens.css re-points resolves to tokens.css's value. */
export function getToken(name: string): TokenEntry | undefined {
  const matches = cssTokens().filter((t) => t.name === name);
  return matches[matches.length - 1];
}
