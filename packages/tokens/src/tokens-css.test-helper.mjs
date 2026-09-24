/* Reading tokens.css's cascade layers as text, for the suites that pin which
 * rules sit in a layer and which do not. Not published: see the
 * `.test-helper.mjs` note in browser.test-helper.mjs.
 *
 * The `.t-*` type classes are read from the file rather than typed out, so a
 * class added to tokens.css is measured by every suite that imports this
 * without an edit here.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = dirname(fileURLToPath(import.meta.url));

/* The stylesheet's own comments talk about `@layer`, which is not the same as
   being in one. */
export const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

export const tokensCss = withoutComments(readFileSync(join(srcDir, 'tokens.css'), 'utf8'));

/**
 * The body of every `@layer <name> { … }` block, brace-matched.
 *
 * Regex cannot do this: a layer block contains nested rules, so `\{[^}]*\}`
 * stops at the first inner `}` and would report a block as empty — which would
 * pass every assertion that reads it while saying nothing. A bare
 * `@layer name;` statement declares an order and holds no declarations, so it
 * is skipped.
 *
 * @param {string} css comment-free CSS
 * @returns {string[]}
 */
export function layerBlocks(css) {
  const blocks = [];
  for (const match of css.matchAll(/@layer\b[^{;]*\{/g)) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (depth > 0 && index < css.length) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}') depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(start, index - 1));
  }
  return blocks;
}

/** tokens.css with every layer block cut out: what is left is unlayered. */
export function unlayered(css) {
  let rest = css;
  for (const block of layerBlocks(css)) rest = rest.replace(block, '');
  return rest;
}

/** `[selectorList, declarations]` for each flat rule in `css`. */
export const rules = (css) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => [
    match[1]
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean),
    match[2],
  ]);

/* The type class a selector is about, or undefined. Loose on purpose, so a
   selector that wraps the class (`:where(.t-h2)`, `h2.t-h2`) is still found
   and measured rather than silently dropped. */
const typeClassOf = (selector) => selector.match(/\.(t-[\w-]+)/)?.[1];

/**
 * Each type class tokens.css declares inside a layer, with its declarations:
 * `{ 't-caption': { 'font-size': 'var(--fs-xs)', color: 'var(--fg-3)', … } }`.
 * Keyed without the dot, the way the class is written in markup.
 */
export const TYPE_RULES = Object.fromEntries(
  layerBlocks(tokensCss)
    .flatMap(rules)
    .filter(([selectors]) => selectors.some(typeClassOf))
    .flatMap(([selectors, body]) => {
      const declarations = Object.fromEntries(
        body
          .split(';')
          .map((declaration) => declaration.trim())
          .filter(Boolean)
          .map((declaration) => {
            const colon = declaration.indexOf(':');
            return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
          }),
      );
      return selectors.map((selector) => [typeClassOf(selector), declarations]);
    }),
);
