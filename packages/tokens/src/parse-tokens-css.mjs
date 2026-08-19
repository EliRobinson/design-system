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
 * Parse the `:root` block of a tokens stylesheet, or of several.
 *
 * Declarations are returned in source order, duplicates included — CSS is
 * last-declaration-wins and callers that care need to see both. Anything
 * outside `:root` — the dark-mode block, a `[data-palette]` block, the `.t-*`
 * classes — is not a default token value and is deliberately ignored.
 *
 * An ARRAY is accepted, and after the palette split it is what most callers
 * should pass. tokens.css @imports palettes.css, so the system's `:root` is
 * spread across two files: read tokens.css alone and `--accent-fg` is missing
 * while `--fg-on-signal: var(--accent-fg)` dangles unresolved. Pass the
 * sources in cascade order — @imported files first, as a browser sees them —
 * and the declarations concatenate in that order, so last-wins still means
 * what CSS means by it. `TOKEN_STYLESHEETS` in ./token-stylesheets.mjs is that
 * list, and `readTokenStylesheets()` reads it off disk.
 *
 * `resolved` follows var() chains across the whole set, including a var()'s
 * fallback when the property it names is not declared anywhere in it —
 * `var(--ds-font-sans-override, 'Geist', …)` resolves to the stack, which is
 * what a browser renders when the consumer has not set the override.
 *
 * @param {string | string[]} css one stylesheet, or several in cascade order
 * @returns {TokenEntry[]}
 */
export function parseTokensCss(css) {
  const raw = (Array.isArray(css) ? css : [css]).flatMap(rootDeclarations);

  const byName = new Map(raw.map((token) => [token.name, token.value]));
  const resolve = (value, depth = 0) => {
    if (depth > MAX_VAR_DEPTH) return value;
    return replaceVars(value, (name, fallback) => {
      const target = byName.get(name);
      if (target !== undefined) return resolve(target, depth + 1);
      /* An undeclared reference with a fallback resolves to the fallback, the
         way a browser does — that is how the --ds-font-*-override hook on the
         family tokens resolves to the shipped stack when nobody sets it.
         Without a fallback there is nothing to resolve to, so it is left as
         written rather than emptied. */
      return fallback === null ? null : resolve(fallback, depth + 1);
    });
  };

  return raw.map((token) => ({ ...token, resolved: resolve(token.value) }));
}

/** The `:root` declarations of one stylesheet, in source order. */
function rootDeclarations(css) {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  /* Declarations are read out of a copy with every comment blanked, so an
     example written inside one — tokens.css documents the font override hook
     with a `--ds-font-sans-override: …;` snippet — is prose, not a token.
     Offsets are preserved, so the trailing comment is still recoverable from
     the original text at the end of each match. */
  const masked = maskComments(root);
  return [...masked.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => ({
    name: match[1],
    value: oneLine(match[2]),
    comment:
      root
        .slice(match.index + match[0].length)
        .match(/^[ \t]*\/\*\s*([\s\S]*?)\s*\*\//)?.[1]
        .replace(/\s+/g, ' ') ?? null,
  }));
}

/* A value long enough for Prettier to wrap it across lines — the font stacks,
   since they gained the override hook — is still one value, and every reader of
   this wants it the way it would have been written by hand. */
function oneLine(value) {
  return value.trim().replace(/\s+/g, ' ').replace(/\(\s/g, '(').replace(/\s\)/g, ')');
}

/** The same text with every comment's interior turned to spaces, offsets kept. */
function maskComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/**
 * Rewrite every top-level `var()` in a value.
 *
 * Hand-scanned rather than regexed because a var() may carry a fallback that
 * itself contains commas and parentheses — `var(--a, var(--b), 'Segoe UI')`.
 *
 * @param {string} value
 * @param {(name: string, fallback: string | null) => string | null} replacer
 *   returns the replacement, or null to leave the `var()` as written.
 * @returns {string}
 */
function replaceVars(value, replacer) {
  let out = '';
  let index = 0;

  while (index < value.length) {
    const start = value.indexOf('var(', index);
    if (start === -1) return out + value.slice(index);

    out += value.slice(index, start);
    const end = closingParen(value, start + 'var('.length - 1);
    if (end === -1) return out + value.slice(start); // unbalanced; leave it alone

    const inner = value.slice(start + 'var('.length, end);
    const comma = inner.indexOf(',');
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();

    const replacement = name.startsWith('--') ? replacer(name, fallback) : null;
    out += replacement === null ? value.slice(start, end + 1) : replacement;
    index = end + 1;
  }

  return out;
}

/** Index of the `)` matching the `(` at `open`, or -1 if there isn't one. */
function closingParen(value, open) {
  let depth = 0;
  for (let index = open; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    else if (value[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
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
