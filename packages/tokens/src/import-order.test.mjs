/* Two invariants a bundler enforces and a standalone CSS file does not. Both
 * are issue #76, and the second one is not the one that actually bit.
 *
 * 1. THE SPECIFIER FORM — this is the fix. Lightning CSS, which is Turbopack's
 *    CSS pipeline, inlines `@import './x.css';` and leaves
 *    `@import url('./x.css');` standing as a literal @import in its output.
 *    That asymmetry is the whole bug. In a consumer's entry stylesheet
 *    `@import 'tailwindcss'` comes first — v4 requires it, and
 *    docs/agents/consumer-tooling.md documents exactly that order — so
 *    Tailwind's rules are inlined ahead of tokens.css and a surviving `url()`
 *    import is stranded after real rules however early it sits WITHIN
 *    tokens.css. It is then invalid, dropped, and every @font-face goes with
 *    it: 0 in the built stylesheet, measured. Silent, too — `next build`
 *    prints the warning to stderr and exits 0. `next dev` 500s.
 *
 *    Isolated against the hoist below in a real Next 16.3.1 + Tailwind v4.3.3
 *    consumer: the string form passes with the hoist reverted, and the hoist
 *    fails with `url()` kept. The string form is necessary AND sufficient.
 *
 * 2. THE ORDERING. tokens.css is valid standalone with its three @imports in
 *    any order — they are adjacent, nothing separates them from the top of the
 *    file — but once palettes.css and mobile.css are inlined, an import that
 *    came after them is preceded by several hundred real rules. Kept and
 *    asserted because it is correct on its own terms and because it is what
 *    saves us if a bundler ever stops inlining the string form too.
 *
 * Assertion 1 is the one that would have caught the shipped bug. Assertion 2
 * passes on a tree that is still broken for consumers, which is precisely why
 * it is not allowed to stand alone.
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

/* Every stylesheet this package publishes that could carry a local @import.
   fonts.css is generated and imports nothing today, but it ships, so it is
   swept too — a generator change that started emitting one would be caught. */
const SHIPPED_STYLESHEETS = ['tokens.css', 'palettes.css', 'mobile.css', 'fonts.css'];

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

  it('uses the string form for every local @import, never url()', () => {
    /* THE assertion — the one that fails on the version of this branch that
       only hoisted the import. `@import url('./fonts.css')` survives Lightning
       CSS as a literal @import; `@import './fonts.css'` is inlined and ceases
       to exist. Only the second can be stranded-proof, because a consumer's
       entry stylesheet puts `@import 'tailwindcss'` ahead of tokens.css and no
       position inside this file escapes that.

       Swept across every stylesheet the package ships rather than tokens.css
       alone: the same edit in palettes.css or mobile.css would fail the same
       way in a consumer and nothing else in the suite would notice. Remote
       imports are exempt — this is about local files a bundler inlines. */
    for (const name of SHIPPED_STYLESHEETS) {
      const urlImports = [
        ...maskComments(read(name)).matchAll(/@import\s+url\(\s*['"]([^'"]+)['"]/g),
      ]
        .map((match) => match[1])
        .filter((specifier) => !/^https?:/.test(specifier));

      expect(
        urlImports,
        `${name} imports these with url(), which Lightning CSS leaves as a ` +
          'literal @import instead of inlining. It is then stranded after the ' +
          "consumer's Tailwind rules, dropped as invalid, and every @font-face " +
          'goes with it. Use the bare string form — see issue #76.',
      ).toEqual([]);
    }
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
