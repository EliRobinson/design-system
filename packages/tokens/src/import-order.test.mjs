/* The invariant a bundler enforces and a standalone CSS file does not.
 *
 * tokens.css is valid on its own with its three @imports in any order, because
 * they are adjacent — nothing separates them from the top of the file. A
 * bundler does not see it that way. webpack, Turbopack, Vite and postcss-import
 * all INLINE an @import at its own position, so once palettes.css and
 * mobile.css have been substituted in, whatever import came after them is
 * preceded by several hundred real rules. `@import` is only valid before any
 * rule, so the parser drops it — and with it, when the dropped import is
 * fonts.css, every @font-face in the package. `next dev` 500s; `next build`
 * warns once and ships a page with no webfonts. Issue #76.
 *
 * So the test flattens the file the way a bundler would and asserts the thing
 * the flattened form has to satisfy: no @import after the first real rule.
 * Reordering the three imports in tokens.css is enough to break it again, and
 * that is exactly the edit this guards.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(srcDir, name), 'utf8');

/* Comments are blanked rather than removed so every offset below is an offset
   into the real file — and so a `{` or the word `@import` written inside one of
   this stylesheet's long prose comments is not mistaken for code. */
const maskComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

/** `@import './x.css';` and `@import url('./x.css');`, both spellings. */
const IMPORT = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;/g;

/**
 * tokens.css with its two sibling stylesheets substituted in at their import
 * sites, which is what every bundler hands the CSS parser. fonts.css is left as
 * an import on purpose: it is the one under test, and inlining it would hide
 * the very ordering the bundler is about to reject.
 */
function flattened() {
  return maskComments(read('tokens.css')).replace(IMPORT, (statement, specifier) => {
    const name = specifier.replace(/^\.\//, '');
    return name === 'palettes.css' || name === 'mobile.css' ? maskComments(read(name)) : statement;
  });
}

/* The first `{` in comment-masked CSS opens the first rule — a `:root {`, an
   `@media`, an `@layer` block, or any selector block. Nothing valid before that
   point can contain one: `@charset`, `@layer <name>;` and `@import` are all
   statements. */
const firstRuleAt = (css) => css.indexOf('{');

describe('tokens.css survives being flattened by a bundler', () => {
  const css = flattened();
  const rule = firstRuleAt(css);

  it('inlines the siblings this test claims to inline', () => {
    /* Guards the test itself: if a rename made the substitution above a no-op,
       every assertion below would pass vacuously on an unflattened file. */
    expect(rule).toBeGreaterThan(0);
    expect(css.length).toBeGreaterThan(read('tokens.css').length);
  });

  it('still carries the fonts.css import after flattening', () => {
    expect([...css.matchAll(IMPORT)].map((match) => match[1])).toContain('./fonts.css');
  });

  it('has no @import after the first rule — the one a parser would discard', () => {
    const dropped = [...css.matchAll(IMPORT)].filter((match) => match.index > rule);

    expect(
      dropped.map((match) => match[1]),
      'an @import that follows a rule is invalid CSS and is silently discarded, ' +
        'taking every @font-face it would have loaded with it — see issue #76',
    ).toEqual([]);
  });

  it('precedes its own imports with nothing but layer statements', () => {
    /* `@layer <name>;` and `@charset` are the only things CSS allows ahead of an
       @import. The layer statement at the top of tokens.css depends on that
       exemption, so a change that turned it into a block — `@layer base { … }`
       — would invalidate every import beneath it just as surely as a `:root`
       there would. Read off the unflattened file: this is about what tokens.css
       itself writes above its first import. */
    const source = maskComments(read('tokens.css'));
    const preamble = source.slice(0, source.search(IMPORT)).trim();

    expect(preamble).toContain('@layer');
    for (const statement of preamble.split(';').filter((part) => part.trim())) {
      expect(statement.trim()).toMatch(/^@(?:layer\s+[\w\s,-]+|charset\s+["'][^"']+["'])$/);
    }
  });
});
