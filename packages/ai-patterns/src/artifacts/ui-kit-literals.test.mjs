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

/* Strips `/* … *\/` block comments (JS/JSX doc comments, and CSS comments inside an
   .html file's <style> block) and `<!-- … -->` HTML comments before matching, so a
   colour word or a `#nnn` cross-reference living in prose never reads as a rendered
   literal. `//` line comments are deliberately left untouched: telling a `//` comment
   apart from a `https://` URL inside a string needs string-literal tracking that a
   plain regex scan doesn't do, and none of the current kits put a colour literal or an
   oklch()/rgba() call after `//` on the same line — so leaving line comments in place
   costs nothing today and avoids a more fragile parser. */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
}

/* Matches oklch(), rgb()/rgba(), hsl()/hsla() and #rgb/#rrggbb, wherever they appear —
   quoted JS string, bare CSS, or mid-string after another value. Deliberately not
   matching `currentColor`, `transparent`, `inherit` or `none`, which carry no brand.
   Comments are stripped first (see `withoutComments`), which is what keeps this broad
   pattern from also flagging a `#119`-shaped issue reference or an oklch() mentioned
   in prose — the two categories are separated by removing comments, not by narrowing
   what counts as a colour. */
const COLOUR_LITERAL = /(oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b)/g;

/** The detector under test: every colour-literal match found in `source`, comments excluded. */
export function colourLiteralsIn(source) {
  return withoutComments(source).match(COLOUR_LITERAL) ?? [];
}

describe('the shipped UI kits paint no colour literals', () => {
  const files = kitFiles();

  it('finds kit files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('$file', ({ source }) => {
    expect(colourLiteralsIn(source)).toEqual([]);
  });
});

describe('colourLiteralsIn', () => {
  const cases = [
    {
      label: 'a quoted hex literal — the one shape the old lookbehind still caught',
      input: "color: '#fff'",
      expected: ['#fff'],
    },
    {
      label: 'a hex literal mid-string, not touching the opening quote',
      input: "borderBottom: '1px solid #ffffff'",
      expected: ['#ffffff'],
    },
    {
      label: 'a hex literal inside an HTML <style> block',
      input: '<style>body{color:#0a0a0a}</style>',
      expected: ['#0a0a0a'],
    },
    {
      label: 'a hex literal in bare CSS with no quotes at all',
      input: '  border: 1px solid #eee;',
      expected: ['#eee'],
    },
    {
      label: 'a GitHub issue reference in a comment, not a colour',
      input: '/* see issue #119 for context */',
      expected: [],
    },
    {
      label: 'a hex literal inside a block comment',
      input: '/* #fff */',
      expected: [],
    },
    {
      label: 'an oklch() call mentioned inside a block comment',
      input: '/* oklch(72.5% 0.175 65) */',
      expected: [],
    },
    {
      label: 'a hex literal inside an HTML comment',
      input: '<!-- background: #fff -->',
      expected: [],
    },
    {
      label: 'a genuine oklch() call, still caught',
      input: "color: 'oklch(72.5% 0.175 65)'",
      expected: ['oklch('],
    },
    {
      label: 'a genuine rgba() call, still caught',
      input: "background: 'rgba(0, 0, 0, 0.5)'",
      expected: ['rgba('],
    },
  ];

  it.each(cases)('$label', ({ input, expected }) => {
    expect(colourLiteralsIn(input)).toEqual(expected);
  });
});
