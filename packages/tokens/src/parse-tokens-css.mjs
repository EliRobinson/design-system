/* The one CSS token parser.
 *
 * tokens.css is the single source of truth for the design system, and several
 * consumers need it as data: the docs site renders the foundations pages from
 * it, `ds tokens` prints it, and the ai-patterns build bakes it into the llms
 * snapshot. Each of those used to carry its own copy of this ~20 lines. Two of
 * the copies were character-for-character identical and the third had silently
 * fallen behind (no var() resolution, no comments), which is the failure mode
 * this file exists to make impossible.
 *
 * Authored as .mjs rather than .ts on purpose: it has to run under plain node
 * from build scripts (including this package's own tokens.json generator, which
 * runs *before* tsc) as well as being importable from TypeScript. Types live in
 * parse-tokens-css.d.mts.
 */

/** How far a var() chain is followed before we give up and return it raw. */
const MAX_VAR_DEPTH = 8;

/**
 * One declaration. Kept in step with `TokenEntry` in parse-tokens-css.d.mts,
 * which is what TypeScript callers see.
 *
 * @typedef {{name: string, value: string, resolved: string, comment: string | null}} TokenEntry
 */

/**
 * Parse the `:root` block of a tokens stylesheet.
 *
 * Declarations are returned in source order, duplicates included — CSS is
 * last-declaration-wins and callers that care (`--status-success` is declared
 * in the base scale and then re-pointed at a brand color) need to see both.
 * Anything outside `:root` — the dark-mode block, the `.t-*` classes — is not a
 * token and is deliberately ignored.
 *
 * @param {string} css
 * @returns {TokenEntry[]}
 */
export function parseTokensCss(css) {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const raw = [...root.matchAll(/(--[\w-]+):\s*([^;]+);(?:[ \t]*\/\*\s*([\s\S]*?)\s*\*\/)?/g)].map(
    (match) => ({
      name: match[1],
      value: match[2].trim(),
      comment: match[3]?.replace(/\s+/g, ' ') ?? null,
    }),
  );

  const byName = new Map(raw.map((token) => [token.name, token.value]));
  const resolve = (value, depth = 0) => {
    if (depth > MAX_VAR_DEPTH) return value;
    return value.replace(/var\((--[\w-]+)\)/g, (whole, name) => {
      const target = byName.get(name);
      return target ? resolve(target, depth + 1) : whole;
    });
  };

  return raw.map((token) => ({ ...token, resolved: resolve(token.value) }));
}

/**
 * The effective value of every token, with CSS's last-declaration-wins applied.
 *
 * @param {TokenEntry[]} tokens
 * @returns {Map<string, TokenEntry>}
 */
export function effectiveTokens(tokens) {
  return new Map(tokens.map((token) => [token.name, token]));
}
