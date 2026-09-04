/* The two properties that make tailwind.css a bridge rather than a copy.
 *
 * The file says both of them about itself, at length, and until now nothing
 * checked either. That matters more than it sounds: both failure modes are
 * silent. A `--color-x: oklch(…)` still compiles, still produces a `bg-x`
 * utility, and simply stops answering to `[data-theme="dark"]` — for that one
 * utility, in a file of eighty. A `--color-x: var(--typo)` compiles too, and
 * emits `background-color: var(--typo)`, which resolves to nothing and paints
 * transparent. Neither is visible in a diff; both are visible here.
 *
 *   1. Every alias is a bare `var()` of a token this package declares. Bare,
 *      because `@theme inline` is what makes the utility compile to the var()
 *      instead of to a snapshot of its value — that is the whole reason all
 *      three dials move Tailwind utilities at runtime with no rebuild. Declared
 *      by this package, because an alias pointing at a name nothing defines is
 *      a utility that paints nothing.
 *
 *   2. `dark:` means the theme dial. Tailwind's stock `dark` variant is
 *      `@media (prefers-color-scheme: dark)` while this system themes on
 *      `[data-theme="dark"]`, so without the `@custom-variant` below they are
 *      two independent switches: the theme toggle moves every token and none of
 *      the `dark:` utilities. This is a one-line fact with a large blast radius
 *      — it governs every `dark:` class in every consuming app — so it is
 *      pinned rather than left to a reader of the file.
 *
 * Read as text rather than compiled, deliberately. Tailwind is a peer of the
 * consumer, not a dependency of this package, and the questions above are about
 * what this file DECLARES. What Tailwind then does with it is Tailwind's
 * contract, and testing it here would only pin their compiler's output.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseTokensCss } from './parse-tokens-css.mjs';
import { TOKENS_SRC_DIR, readTokenStylesheets } from './token-stylesheets.mjs';

const bridge = readFileSync(join(TOKENS_SRC_DIR, 'tailwind.css'), 'utf8');

/* Blanked, not removed, so a `{`, a `@custom-variant` or a `--color-…` written
   inside this file's long prose comments cannot be read as code. The header
   alone contains several of each. */
const code = bridge.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

/** The body of the first `<at-rule-or-selector> { … }` block whose head matches. */
function block(head) {
  const start = code.search(head);
  expect(start, `${head} block is missing from tailwind.css`).toBeGreaterThan(-1);

  const open = code.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === '{') depth += 1;
    else if (code[index] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, index);
    }
  }

  throw new Error(`${head} block is unterminated`);
}

const declarations = (body) =>
  [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => ({
    name,
    value: value.trim(),
  }));

const themeAliases = declarations(block(/@theme\s+inline\b/));
/* The `--ds-*` indirection layer, plus `--radius`, which shadcn components read
   directly rather than through a utility class. Declared by this file, so an
   alias may legitimately point at one. */
const bridgeLocals = declarations(block(/^:root\b/m));

const declaredTokens = new Set([
  ...parseTokensCss(readTokenStylesheets()).map((token) => token.name),
  ...bridgeLocals.map((local) => local.name),
]);

describe('tailwind.css: every alias is a bare var() of a declared token', () => {
  it('declares aliases at all — a silently empty parse would pass everything below', () => {
    expect(themeAliases.length).toBeGreaterThan(60);
    expect(bridgeLocals.length).toBeGreaterThan(10);
  });

  it.each([...themeAliases, ...bridgeLocals].map(({ name, value }) => [name, value]))(
    '%s is var(--token)',
    (name, value) => {
      expect(value, `${name} is not a bare var() — it snapshots a value`).toMatch(
        /^var\(\s*--[\w-]+\s*\)$/,
      );
    },
  );

  it.each([...themeAliases, ...bridgeLocals].map(({ name, value }) => [name, value]))(
    '%s points at a token this package declares',
    (name, value) => {
      const referenced = value.match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
      expect(declaredTokens, `${name}: ${referenced} is declared nowhere`).toContain(referenced);
    },
  );

  it('never points an alias at itself', () => {
    for (const { name, value } of themeAliases) {
      expect(value, `${name} is self-referencing — see note 2 in the file`).not.toBe(
        `var(${name})`,
      );
    }
  });
});

describe('tailwind.css: dark: follows the theme dial, not the operating system', () => {
  const variant = code.match(/@custom-variant\s+dark\s*\((.*)\)\s*;/);
  const selectors = variant?.[1]
    .match(/^&\s*:where\((.*)\)$/)?.[1]
    .split(',')
    .map((part) => part.trim());

  it('declares a dark custom variant', () => {
    expect(variant, '`dark:` falls back to @media (prefers-color-scheme: dark)').not.toBeNull();
  });

  it('adds no specificity, so a dark: utility still ranks by source order', () => {
    expect(variant[1], 'the selector list is not wrapped in :where()').toMatch(/^&\s*:where\(/);
    expect(selectors).toBeDefined();
  });

  /* Both spellings, because tokens.css themes on both; and each as the element
     itself as well as an ancestor, because the attribute lives on <html> while
     the utility is on a descendant. Miss the descendant form and `dark:` only
     ever fires on <html>. */
  it.each(["[data-theme='dark']", "[data-theme='dark'] *", '.dark', '.dark *'])(
    'matches %s',
    (selector) => {
      expect(selectors).toContain(selector);
    },
  );
});
