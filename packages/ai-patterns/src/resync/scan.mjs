/* Finding a token in a consumer's files, and everything about WHERE it is.
 *
 * A migration is only ever as safe as the context it can establish. Rewriting
 * `--status-warning` to `--status-warning-border` is correct on a border and
 * wrong on a background, so a scanner that returns "line 12 mentions
 * --status-warning" is not enough to act on — it is enough to guess with, which
 * is the thing this module exists to avoid.
 *
 * So every occurrence carries two facts alongside its position:
 *
 *   - `property`, the CSS property the token is a value of. Read by walking
 *     back to the declaration's `:`. `borderColor` in a JS style object
 *     normalises to `border-color`, so one table of properties serves CSS and
 *     TSX alike.
 *   - `blockDeclarations`, every design token inside the enclosing `{ … }`
 *     PAIRED WITH the property it is a value of. A CSS rule block and a JS
 *     object literal are both braces, so the same brace walk answers "is this
 *     text drawn on a status fill" in either — and the pairing is what keeps
 *     that question apart from "does a status token appear somewhere nearby".
 *
 * Both are allowed to come back UNKNOWN, and that is the point. `property` is
 * null whenever the walk does not land on something that reads as a property —
 * a ternary, a template hole, a helper call — and the caller turns a null into
 * a review rather than a rewrite. The precedent is `bumpRange` in apply.mjs,
 * which returns null for a range it cannot rewrite safely so the caller can
 * report it instead of silently changing the consumer's intent. Same line.
 */

/** How far back a walk will look before giving up. A declaration longer than
 *  this is not one we can read, and reading further is not free. */
const LOOKBACK = 4000;

/** Characters that can appear in a property key, CSS or JS. */
const KEY_CHARACTER = /[A-Za-z0-9_$-]/;

/** What a property has to look like to be believed: `color`, `border-color`,
 *  `--my-edge`, `WebkitTextFillColor`. Anything else means the walk landed on
 *  something that is not a declaration. */
const PLAUSIBLE_KEY = /^(?:--)?[A-Za-z][A-Za-z0-9-]*$/;

/** Every design token named anywhere in a chunk of text. */
const TOKEN_MENTION = /--[a-z][a-z0-9-]*/g;

/** The extensions worth reading. A token can only be referenced from something
 *  that ends up as CSS or as a style value in script. */
export const SCANNED_EXTENSIONS = [
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.pcss',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.astro',
];

/** Directories never worth walking into: generated, vendored, or ours. */
export const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  'dist',
  'build',
  'out',
  'coverage',
  'storybook-static',
  '.vercel',
  '.output',
]);

/**
 * `borderColor` → `border-color`, `WebkitTextFillColor` → `-webkit-text-fill-color`.
 * A name that is already kebab-case, or is a custom property, comes back as it
 * went in.
 */
export function normalizeProperty(key) {
  if (key.startsWith('--')) return key;
  if (key.includes('-')) return key.toLowerCase();
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * The property whose value this offset sits inside, or null when the walk
 * cannot establish one.
 *
 * Walks left to the nearest `:`, stopping at `;` `{` `}` — any of which means
 * the offset is not in a declaration value at all — then reads the key to the
 * left of that `:`.
 *
 * The failure that matters is a ternary: in
 * `color: warn ? 'var(--a)' : 'var(--b)'` the second reference's nearest `:`
 * belongs to the ternary, and the key walk from there runs into `'` and `)`
 * and yields nothing plausible. That returns null, which downgrades a rewrite
 * to a review — the conservative direction, and the correct one, because the
 * two branches may not want the same treatment.
 */
export function propertyAt(source, offset) {
  let index = offset - 1;
  const floor = Math.max(0, offset - LOOKBACK);

  while (index >= floor) {
    const character = source[index];
    if (character === ':') break;
    if (character === ';' || character === '{' || character === '}') return null;
    index -= 1;
  }

  if (index < floor || source[index] !== ':') return null;

  // Left of the colon: optional whitespace, an optional quote, then the key.
  let end = index - 1;
  while (end >= floor && /\s/.test(source[end])) end -= 1;
  if (end >= floor && (source[end] === '"' || source[end] === "'")) end -= 1;

  let start = end;
  while (start >= floor && KEY_CHARACTER.test(source[start])) start -= 1;

  const key = source.slice(start + 1, end + 1);
  if (!PLAUSIBLE_KEY.test(key)) return null;

  return normalizeProperty(key);
}

/**
 * The text of the innermost `{ … }` containing this offset, or null when the
 * offset is not inside braces.
 *
 * Braces are counted rather than parsed. A `{` inside a string or a comment
 * would throw the count off, and the answer is only ever used to NARROW a
 * review — never to authorise a rewrite — so being occasionally wrong costs a
 * human one glance at a line that turned out to be fine.
 */
export function blockAt(source, offset) {
  let depth = 0;
  let open = -1;

  for (let index = offset - 1; index >= Math.max(0, offset - LOOKBACK); index -= 1) {
    const character = source[index];
    if (character === '}') depth += 1;
    else if (character === '{') {
      if (depth === 0) {
        open = index;
        break;
      }
      depth -= 1;
    }
  }

  if (open === -1) return null;

  depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return { text: source.slice(open, index + 1), start: open };
    }
  }

  return { text: source.slice(open), start: open };
}

/**
 * Every design token named inside a block, paired with the property it is a
 * value of.
 *
 * The pairing is what makes "is this text drawn on a status fill" answerable
 * rather than merely guessable. The fixture consumer proved the difference:
 * a JSX style object holding `borderColor: 'var(--status-warning)'` alongside
 * a `color` mentions a status token, but paints no fill, and a heuristic that
 * only counted mentions flagged the colour as if it sat on one.
 */
export function blockDeclarations(source, block) {
  if (block === null) return [];

  const declarations = [];
  for (const match of block.text.matchAll(TOKEN_MENTION)) {
    declarations.push({
      token: match[0],
      property: propertyAt(source, block.start + match.index),
    });
  }

  return declarations;
}

/**
 * A copy of the source with every comment blanked and every offset preserved,
 * so a token named in prose is not reported as a call site.
 *
 * The fixture that forced this was a comment reading "a warning FILL is still
 * --status-warning", which the scanner dutifully offered to migrate. Blanking
 * rather than deleting is the same trick `parseTokensCss` uses on tokens.css,
 * and for the same reason: every position in this string still indexes the real
 * file, so a match found here can be rewritten there.
 *
 * Block comments only, plus line comments that START a line. `//` in the middle
 * of a line is as likely to be inside a `url(https://…)` as it is to be a
 * comment, and masking a live declaration would UNDER-report — the one
 * direction this tool must never fail in.
 */
export function maskComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(
      /^([ \t]*)\/\/[^\n]*/gm,
      (match, indent) => indent + ' '.repeat(match.length - indent.length),
    );
}

/** Line and column, both 1-based, the way an editor counts them. */
export function positionAt(source, offset) {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - (before.lastIndexOf('\n') + 1) + 1;
  return { line, column };
}

/**
 * A regex matching exactly these token names and no longer name that starts
 * with one of them.
 *
 * The terminator is what makes it safe: without it `--status-warning` matches
 * inside `--status-warning-border`, and the tool would migrate the token it
 * just told the consumer to migrate TO. Longest-first alternation keeps the
 * engine from settling for a prefix when a longer name is also in the set.
 */
export function tokenPattern(names) {
  const escaped = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})(?![A-Za-z0-9_-])`, 'g');
}

/**
 * Every occurrence of any of `names` in one file's text.
 *
 * @param {string} source the file's contents
 * @param {string} file the path reported back, as given
 * @param {Iterable<string>} names the token names to look for
 * @returns {Array<{file: string, token: string, offset: number, end: number,
 *   line: number, column: number, property: string | null,
 *   inCustomProperty: boolean,
 *   blockDeclarations: Array<{token: string, property: string | null}>,
 *   text: string}>}
 */
export function scanSource(source, file, names) {
  const nameList = [...names];
  if (nameList.length === 0) return [];

  const pattern = tokenPattern(nameList);
  const occurrences = [];
  /* Matched against the masked copy, but every position and every slice below
     comes from the real one — the two are the same length by construction. */
  const searchable = maskComments(source);

  for (const match of searchable.matchAll(pattern)) {
    const offset = match.index;
    const property = propertyAt(searchable, offset);
    const block = blockAt(searchable, offset);
    const lineStart = source.lastIndexOf('\n', offset) + 1;
    const lineEnd = source.indexOf('\n', offset);

    occurrences.push({
      file,
      token: match[1],
      offset,
      end: offset + match[1].length,
      ...positionAt(source, offset),
      property,
      // A consumer aliasing our token into their own variable is the case the
      // tool must never rewrite through: everything downstream of the alias is
      // invisible from here, so the property this ends up painting is unknown
      // no matter how readable this line is.
      inCustomProperty: property !== null && property.startsWith('--'),
      blockDeclarations: blockDeclarations(searchable, block),
      text: source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).trim(),
    });
  }

  return occurrences;
}
