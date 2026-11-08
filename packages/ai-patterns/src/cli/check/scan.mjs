// Reads a consumer repo once, for every check in traps.mjs to share.
//
// The consumer's own files only. `.claude/` is skipped as well as the usual
// generated trees: `ds-resync artifacts` writes copies of our stylesheets
// there on purpose, and the stale-artifacts check reads its record instead.

import { readFileSync, statSync } from 'node:fs';
import { dirname, relative } from 'node:path';

import { RECORD_PATH } from '../../resync/artifacts.mjs';
import { collectFiles } from '../../resync/migrate.mjs';
import {
  IGNORED_DIRECTORIES,
  maskComments,
  positionAt,
  STYLESHEET_EXTENSIONS,
} from '../../resync/scan.mjs';

/** The stylesheets that carry tokens.css. Importing either one is "using the design system". */
export const DS_STYLESHEETS = ['@elirobinson/react/styles.css', '@elirobinson/tokens/tokens.css'];

/** Files over this size are generated or vendored, not something a person wrote. */
const MAX_BYTES = 1_000_000;

const IGNORED = new Set([...IGNORED_DIRECTORIES, dirname(RECORD_PATH)]);

/* `@import 'x';`, `@import "x" layer(base);`, `@import url(x);`, `@import url('x') screen;`.
   The same pattern as scripts/tarball-consumer/css.mjs, which a published
   package cannot import. */
const IMPORT = /@import\s+(?:url\(\s*(['"]?)([^'")\s]+)\1\s*\)|(['"])([^'"]+)\3)([^;]*);/g;

/**
 * @typedef {{ specifier: string, tail: string, line: number }} CssImport
 *   `tail` is whatever follows the specifier: `layer(base)`, a media query.
 * @typedef {{ path: string, text: string, masked: string, imports: CssImport[] }} ScannedFile
 *   `path` is relative to the repo root. `masked` has comments blanked, same
 *   offsets. `imports` is empty for a script.
 */

/** Every `@import` in a stylesheet. */
function cssImports(text, masked) {
  return [...masked.matchAll(IMPORT)].map((match) => ({
    specifier: match[2] ?? match[4],
    tail: match[5].trim(),
    line: positionAt(text, match.index).line,
  }));
}

/**
 * @param {string} root consumer repo root
 * @returns {{ css: ScannedFile[], source: ScannedFile[] }}
 */
export function scanRepo(root) {
  const css = [];
  const source = [];

  for (const absolute of collectFiles(root, { ignored: IGNORED })) {
    let text;
    try {
      if (statSync(absolute).size > MAX_BYTES) continue;
      text = readFileSync(absolute, 'utf8');
    } catch {
      continue;
    }

    const masked = maskComments(text);
    const isCss = STYLESHEET_EXTENSIONS.some((extension) => absolute.endsWith(extension));
    const file = {
      path: relative(root, absolute),
      text,
      masked,
      imports: isCss ? cssImports(text, masked) : [],
    };
    (isCss ? css : source).push(file);
  }

  return { css, source };
}

/** True when a script imports one of `specifiers` for its side effect (`import 'x.css'`). */
export function scriptImports(file, specifiers) {
  return [...file.masked.matchAll(/import\s+['"]([^'"]+)['"]/g)].some((match) =>
    specifiers.includes(match[1]),
  );
}

/**
 * Every custom-property declaration in a stylesheet, with the preludes of the
 * blocks around it, outermost first: `['@layer base', ':root']` for
 * `@layer base { :root { --accent: red; } }`. One pass over the masked text.
 *
 * Only a name at the start of a statement counts, so `.btn--accent:hover` in a
 * selector is not read as a declaration of `--accent`.
 *
 * @returns {{ name: string, index: number, blocks: string[] }[]}
 */
export function declarations(masked) {
  const found = [];
  const stack = [];
  let start = 0;

  for (let index = 0; index < masked.length; index += 1) {
    const character = masked[index];
    if (character === '{') {
      stack.push(masked.slice(start, index).trim());
      start = index + 1;
    } else if (character === '}' || character === ';') {
      if (character === '}') stack.pop();
      start = index + 1;
    } else if (character === '-' && masked.slice(start, index).trim() === '') {
      const match = /^(--[\w-]+)\s*:/.exec(masked.slice(index));
      if (match) found.push({ name: match[1], index, blocks: [...stack] });
    }
  }

  return found;
}
