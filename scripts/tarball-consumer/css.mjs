/* Just enough CSS reading to follow a stylesheet's references the way a
 * consumer's bundler does. Not a parser: it reads @import statements and url()
 * tokens, which is all the packaging bugs this guards against have ever needed.
 */

/* Comments are blanked rather than removed, so offsets stay offsets into the
   real file and a `{` or an `@import` in prose is not read as code. Same rule
   as packages/tokens/src/import-order.test.mjs. */
export const maskComments = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

/* `@import 'x';`, `@import "x" layer(base);`, `@import url(x);`,
   `@import url('x') screen;`. */
const IMPORT = /@import\s+(?:(url)\(\s*(['"]?)([^'")\s]+)\2\s*\)|(['"])([^'"]+)\4)([^;]*);/g;

/**
 * Every @import in a stylesheet.
 *
 * @returns {{ specifier: string, form: 'string' | 'url', index: number, statement: string }[]}
 */
export function cssImports(css) {
  return [...maskComments(css).matchAll(IMPORT)].map((match) => ({
    specifier: match[3] ?? match[5],
    form: match[1] ? 'url' : 'string',
    index: match.index,
    statement: match[0],
  }));
}

/** Every url() that is not part of an @import, e.g. a font `src`. */
export function cssUrls(css) {
  const masked = maskComments(css).replace(IMPORT, (statement) => ' '.repeat(statement.length));
  return [...masked.matchAll(/url\(\s*(['"]?)([^'")]+?)\1\s*\)/g)].map((match) => match[2].trim());
}

/** A reference a bundler fetches from somewhere else, or never fetches. */
export const isExternal = (reference) =>
  /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\/)/i.test(reference) || reference.startsWith('%23');

/** The file part of a url() reference: `./a.woff2?v=1#x` → `./a.woff2`. */
export const stripQuery = (reference) => reference.replace(/[?#].*$/, '');

/* The first `{` in comment-masked CSS opens the first rule. Nothing CSS allows
   ahead of an @import — `@charset`, `@layer a, b;`, another @import — has one. */
export const firstRuleAt = (css) => maskComments(css).indexOf('{');

/** The @imports a stylesheet writes after its own first rule. */
export function importsAfterFirstRule(css) {
  const rule = firstRuleAt(css);
  if (rule === -1) return [];
  return cssImports(css).filter((entry) => entry.index > rule);
}

/**
 * The stylesheet a bundler hands its CSS parser: every string-form @import
 * replaced, in place, by the file it names, recursively.
 *
 * The `url()` form is left standing as a literal @import, because that is what
 * Lightning CSS (Turbopack's pipeline) does with it. That asymmetry is #76: a
 * `url()` import inside tokens.css survives inlining, lands after the rules of
 * the Tailwind import a consumer writes first, and is dropped as invalid.
 *
 * @param {string} entry the consumer's entry stylesheet
 * @param {(specifier: string, from: string | null) => { file: string, css: string } | null} load
 *   resolves and reads one import; `from` is the importing file, null for the entry
 */
export function flatten(entry, load, from = null, seen = new Set()) {
  return maskComments(entry).replace(IMPORT, (statement, url, _q, _u, _s, specifier) => {
    if (url || isExternal(specifier)) return statement;
    const loaded = load(specifier, from);
    if (!loaded) return statement;
    /* Bundlers include a stylesheet once, at its first import. */
    if (seen.has(loaded.file)) return '';
    seen.add(loaded.file);
    return flatten(loaded.css, load, loaded.file, seen);
  });
}
