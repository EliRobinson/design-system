/* Reading tokens.css's cascade layers as text, for the suites that pin which
 * rules sit in a layer and which do not. Not published: see the
 * `.test-helper.mjs` note in browser.test-helper.mjs.
 *
 * The `.t-*` type classes are read from the file rather than typed out, so a
 * class added to tokens.css is measured by every suite that imports this
 * without an edit here. Two readings of the same file, kept apart on purpose:
 * the unlayered rules (the type ramp) and the `@layer base` rules (the colour,
 * #251). The suites assert that the two agree.
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

const isTypeClass = (selector) => /^\.t-[\w-]+$/.test(selector);

/** Every type class the unlayered ramp declares, `.t-code` included. */
export const TYPE_CLASSES = rules(unlayered(tokensCss))
  .flatMap(([selectors]) => selectors)
  .filter(isTypeClass);

/**
 * Each layered type class and the token its colour resolves to, e.g.
 * `{ '.t-caption': '--fg-3' }`.
 */
export const LAYERED_TYPE_COLOURS = Object.fromEntries(
  layerBlocks(tokensCss)
    .flatMap(rules)
    .filter(([selectors]) => selectors.every(isTypeClass))
    .flatMap(([selectors, body]) => {
      const token = body.match(/color:\s*var\((--[\w-]+)\)/)?.[1];
      return selectors.map((selector) => [selector, token]);
    }),
);
