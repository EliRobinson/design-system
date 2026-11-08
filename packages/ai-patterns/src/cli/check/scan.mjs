// Reads a consumer repo once, for every check in traps.mjs to share.
//
// The consumer's own files only. `.claude/` is skipped as well as the usual
// generated trees: `ds-resync artifacts` writes copies of our stylesheets
// there on purpose, and the stale-artifacts check reads its record instead.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { collectFiles } from '../../resync/migrate.mjs';
import { IGNORED_DIRECTORIES, maskComments, positionAt } from '../../resync/scan.mjs';

/** The stylesheets that carry tokens.css. Importing either one is "using the design system". */
export const DS_STYLESHEETS = ['@elirobinson/react/styles.css', '@elirobinson/tokens/tokens.css'];

const CSS_EXTENSIONS = ['.css', '.scss', '.sass', '.less', '.pcss'];

/** Files over this size are generated or vendored, not something a person wrote. */
const MAX_BYTES = 1_000_000;

const IGNORED = new Set([...IGNORED_DIRECTORIES, '.claude']);

/**
 * @param {string} root consumer repo root
 * @returns {{ css: ScannedFile[], source: ScannedFile[] }}
 *
 * @typedef {{ path: string, text: string, masked: string }} ScannedFile
 *   `path` is relative to `root`. `masked` has comments blanked, same offsets.
 */
export function scanRepo(root) {
  const css = [];
  const source = [];

  for (const absolute of collectFiles(root, { ignored: IGNORED })) {
    let text;
    try {
      text = readFileSync(absolute, 'utf8');
    } catch {
      continue;
    }
    if (text.length > MAX_BYTES) continue;

    const file = { path: relative(root, absolute), text, masked: maskComments(text) };
    (CSS_EXTENSIONS.some((extension) => absolute.endsWith(extension)) ? css : source).push(file);
  }

  return { css, source };
}

/** Every `@import` in a stylesheet: what it names, what follows it, and where. */
export function cssImports(file) {
  const pattern = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?([^;]*);/g;
  return [...file.masked.matchAll(pattern)].map((match) => ({
    specifier: match[1],
    tail: match[2].trim(),
    line: positionAt(file.text, match.index).line,
  }));
}

/** True when a script imports one of `specifiers` for its side effect (`import 'x.css'`). */
export function scriptImports(file, specifiers) {
  return [...file.masked.matchAll(/import\s+['"]([^'"]+)['"]/g)].some((match) =>
    specifiers.includes(match[1]),
  );
}

/**
 * The preludes of every block that encloses `offset`, outermost first:
 * `['@layer base', ':root']` for a declaration inside `@layer base { :root { … } }`.
 * Reads the comment-masked text, so a brace in a comment does not count.
 */
export function enclosingBlocks(masked, offset) {
  const stack = [];
  let start = 0;

  for (let index = 0; index < offset; index += 1) {
    const character = masked[index];
    if (character === '{') {
      stack.push(masked.slice(start, index).trim());
      start = index + 1;
    } else if (character === '}') {
      stack.pop();
      start = index + 1;
    } else if (character === ';') {
      start = index + 1;
    }
  }

  return stack;
}
