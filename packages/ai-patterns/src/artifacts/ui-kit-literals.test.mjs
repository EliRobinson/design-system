/* The shipped UI kits, checked for colour literals.
 *
 * eslint.config.mjs ignores design-system-docs/** wholesale, which is exactly why
 * Primitives.jsx painted the wordmark's period `oklch(72.5% 0.175 65)` — --signal-500
 * under ember, written as a constant — and the wordmark stayed amber under every other
 * palette. The kits are static JSX with no build step, so un-ignoring them would cascade;
 * the guard is a test instead.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const kitsDir = join(here, '..', '..', '..', '..', 'design-system-docs', 'ui_kits');

/** Every .jsx and .html file under ui_kits, as {file, source}. */
function kitFiles(dir = kitsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return kitFiles(path);
    if (!/\.(jsx|html)$/.test(entry.name)) return [];
    return [{ file: relative(kitsDir, path), source: readFileSync(path, 'utf8') }];
  });
}

/* Matches oklch(), rgb()/rgba(), hsl()/hsla() and #rgb/#rrggbb. Deliberately not
   matching `currentColor`, `transparent`, `inherit` or `none`, which carry no brand. */
const COLOUR_LITERAL = /(oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b)/g;

describe('the shipped UI kits paint no colour literals', () => {
  const files = kitFiles();

  it('finds kit files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('$file', ({ source }) => {
    expect(source.match(COLOUR_LITERAL) ?? []).toEqual([]);
  });
});
