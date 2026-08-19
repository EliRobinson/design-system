/* The product token layer, enforced.
 *
 * docs/agents/product-token-layer.md describes a pattern rather than a token
 * set: a consuming product may declare a small, fixed list of `--product-*`
 * variables inside its own `[data-product]` scope, and every component that
 * reads one falls back to a system token so the layer is always optional.
 *
 * A pattern documented only in prose is a pattern that drifts. Two things are
 * asserted here, both of them mechanical:
 *
 *   1. Every `var(--product-…)` read in a component stylesheet has a
 *      `var(--system-token)` fallback — not nothing, not a literal, not a
 *      second product variable. A bare read paints nothing at all for the
 *      consumer who adopted none of this, which is the failure mode the
 *      fallback rule exists to prevent; a literal fallback is a colour that
 *      neither contrast.test.mjs nor component-css.test.mjs can follow.
 *   2. The set of product variables the components actually read is exactly
 *      the set the doc's table names. Double-entry, so neither side can move
 *      without the other.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '..', 'src', 'components');
const docPath = join(here, '..', '..', '..', 'docs', 'agents', 'product-token-layer.md');

/** Every `<tier>/<Name>.css` under src/components, as {file, css}. */
function stylesheets(dir = componentsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    if (!entry.name.endsWith('.css')) return [];
    return [{ file: relative(componentsDir, path), css: readFileSync(path, 'utf8') }];
  });
}

const SHEETS = stylesheets();

/* `var(--product-name` plus whatever follows up to the matching close. Read
   with a small scanner rather than one regex: a fallback is itself a var()
   call, so the closing paren cannot be found by a non-greedy match. */
function productReads(css) {
  const reads = [];
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of withoutComments.matchAll(/var\(\s*(--product-[\w-]+)/g)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < withoutComments.length && depth > 0) {
      if (withoutComments[index] === '(') depth += 1;
      if (withoutComments[index] === ')') depth -= 1;
      index += 1;
    }
    const inner = withoutComments.slice(match.index + match[0].length, index - 1);
    reads.push({
      name: match[1],
      fallback: inner.replace(/^\s*,\s*/, '').trim(),
      text: withoutComments.slice(match.index, index),
    });
  }
  return reads;
}

const READS = SHEETS.flatMap(({ file, css }) =>
  productReads(css).map((read) => ({ ...read, file })),
);

describe('the product layer is always optional', () => {
  it('finds product-layer reads to check — the scanner has not gone stale', () => {
    // A path change or a regex rot that emptied this list would make every
    // assertion below pass vacuously.
    expect(READS.length).toBeGreaterThan(0);
    expect(productReads('color: var(--product-signal-fg, var(--status-warning-fg));')).toEqual([
      {
        name: '--product-signal-fg',
        fallback: 'var(--status-warning-fg)',
        text: 'var(--product-signal-fg, var(--status-warning-fg))',
      },
    ]);
  });

  for (const read of READS) {
    it(`${read.file}: ${read.name} falls back to a system token`, () => {
      expect(
        read.fallback,
        `${read.text} in ${read.file} reads a product variable with no fallback. A ` +
          'consumer that adopted none of the product layer would get no value at all ' +
          'here. Write var(--product-x, var(--system-token)).',
      ).not.toBe('');

      const fallback = read.fallback.match(/^var\(\s*(--[\w-]+)\s*\)$/);
      expect(
        fallback,
        `${read.text} in ${read.file} falls back to "${read.fallback}", which is not a ` +
          'single var(--system-token). A literal is a colour the contrast gate cannot ' +
          'follow; a longer chain has no guaranteed end.',
      ).not.toBeNull();

      expect(
        fallback[1].startsWith('--product-'),
        `${read.text} in ${read.file} falls back to another product variable. The ` +
          'fallback is what makes the layer optional, so it has to be a system token.',
      ).toBe(false);
    });
  }
});

describe('the documented table matches what the components read', () => {
  const doc = readFileSync(docPath, 'utf8');

  /* Rows look like: | `--product-signal` | `--accent-press` | Role … | */
  const documented = new Map(
    [...doc.matchAll(/^\|\s*`(--product-[\w-]+)`\s*\|\s*`(--[\w-]+)`\s*\|/gm)].map((row) => [
      row[1],
      row[2],
    ]),
  );

  it('parsed the doc table — the row pattern has not gone stale', () => {
    expect(documented.size).toBeGreaterThan(0);
  });

  it('documents exactly the product variables the components read', () => {
    const read = new Set(READS.map((entry) => entry.name));
    expect([...read].sort()).toEqual([...documented.keys()].sort());
  });

  it('documents the same system fallback each component actually uses', () => {
    for (const read of READS) {
      const fallback = read.fallback.match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
      expect(
        documented.get(read.name),
        `${read.file} falls ${read.name} back to ${fallback}, the doc says ` +
          `${documented.get(read.name)}`,
      ).toBe(fallback);
    }
  });
});
