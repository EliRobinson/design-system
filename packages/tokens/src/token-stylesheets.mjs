/* Which files declare tokens, and how to read them.
 *
 * tokens.css used to be the whole vocabulary, so "read the tokens" meant "read
 * one file" and eight call sites across four packages each spelled that path
 * out for themselves. The palette split made that wrong in a way that does not
 * announce itself: reading tokens.css alone still parses, still returns a few
 * hundred declarations, and simply omits the brand — `--accent-fg` is gone and
 * `--fg-on-signal: var(--accent-fg)` resolves to itself.
 *
 * So the roster lives here, once, and every reader asks for it rather than
 * knowing it. Adding a fourth stylesheet is a one-line change in this file and
 * nowhere else.
 *
 * Authored as .mjs to match the other two: it has to run under plain node from
 * build scripts as well as being importable from TypeScript. Types live in
 * token-stylesheets.d.mts.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The token-declaring stylesheets, in CASCADE order — @imported files first,
 * the way a browser flattens them.
 *
 * Order matters because CSS is last-declaration-wins and `parseTokensCss`
 * reproduces that. tokens.css @imports palettes.css at the top, so palettes.css
 * is the earlier of the two.
 *
 * mobile.css is deliberately absent. It declares no name that tokens.css does
 * not already declare — it re-points radii, the small end of the type ramp,
 * the gutter and two containers — and every one of its declarations sits
 * behind `[data-platform='mobile']` or a media query rather than in a `:root`
 * that is true by default. It contributes nothing to the roster and reading it
 * here would report platform overrides as if they were defaults.
 */
export const TOKEN_STYLESHEETS = ['palettes.css', 'tokens.css'];

/**
 * The PLATFORM stylesheets — the layer selected by `data-platform`.
 *
 * A separate roster rather than an entry in the one above, because the two
 * answer different questions. `TOKEN_STYLESHEETS` is "what is a token's
 * default value", and mobile.css is not in it for the reason spelled out
 * above: every declaration it carries sits behind an attribute or a media
 * query, so reading it as a default would report a phone's radius as the
 * system's radius.
 *
 * But "what moves when `data-platform` is set" is a real question — it is what
 * `ds dials` reports and what a consumer otherwise has to read the stylesheet
 * to find out — and answering it needs the file. So it is named here, once,
 * and `dials.mjs` reads it through this rather than spelling the filename.
 */
export const PLATFORM_STYLESHEETS = ['mobile.css'];

/** This package's own `src/`, so a caller inside the repo needs no path. */
export const TOKENS_SRC_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The contents of every token stylesheet, in cascade order, ready to hand
 * straight to `parseTokensCss`.
 *
 * @param {string} [srcDir] the directory holding tokens.css — defaults to this
 *   package's own `src/`. A consumer that resolved `@elirobinson/tokens/tokens.css`
 *   through the exports map passes that file's `dirname`.
 * @returns {string[]}
 */
export function readTokenStylesheets(srcDir = TOKENS_SRC_DIR) {
  return TOKEN_STYLESHEETS.map((name) => readFileSync(join(srcDir, name), 'utf8'));
}

/**
 * The contents of every platform stylesheet, in cascade order.
 *
 * @param {string} [srcDir] defaults to this package's own `src/`.
 * @returns {string[]}
 */
export function readPlatformStylesheets(srcDir = TOKENS_SRC_DIR) {
  return PLATFORM_STYLESHEETS.map((name) => readFileSync(join(srcDir, name), 'utf8'));
}
