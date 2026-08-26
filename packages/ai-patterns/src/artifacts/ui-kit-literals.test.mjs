/* The shipped UI kits, checked for colour literals.
 *
 * eslint.config.mjs ignores design-system-docs/** wholesale, which is exactly why
 * Primitives.jsx painted the wordmark's period `oklch(72.5% 0.175 65)` — --signal-500
 * under ember, written as a constant — and the wordmark stayed amber under every other
 * palette. The kits are static JSX with no build step, so un-ignoring them would cascade;
 * a test guards the kits instead.
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
   .html file's <style> block), `<!-- … -->` HTML comments, and `//` line comments
   before matching, so a colour word or a `#nnn` cross-reference living in prose never
   reads as a rendered literal.
 *
 * This is a single-pass character scanner, not a pair of regexes, because a regex scan
 * can't tell a `/*` or `<!--` delimiter that's sitting inside a string literal from a
 * real comment opener. A single-quoted string, double-quoted string, or backtick
 * template literal containing either sequence — e.g. a URL comment written as a string,
 * or markup assembled as a template literal — would have had everything up to the next
 * `*\/` treated as commented out and silently dropped from what the guard checks,
 * including any real colour literal that followed. The scanner tracks whether it is
 * inside a string and, if so, treats `/*` and `<!--` as ordinary characters; it also
 * honours backslash escapes inside strings (`'it\'s'` doesn't end the string early).
 * An unterminated `/*` or `<!--` (no closing delimiter) consumes to end of input rather
 * than throwing.
 *
 * `//` line comments are now stripped too: once the scanner already tracks string
 * state, telling a `//` comment apart from a `https://` URL inside a string is free —
 * a `//` is only treated as a comment when it appears outside a string — so there's no
 * remaining reason to leave line comments in place.
 */
function withoutComments(source) {
  let result = '';
  let quote = null; // one of ' " ` while inside a string, otherwise null

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (quote) {
      result += ch;
      if (ch === '\\' && i + 1 < source.length) {
        // Copy the escaped character verbatim so it can't end the string early
        // (and so an escaped quote isn't mistaken for the closing quote).
        result += source[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      result += ch;
      continue;
    }

    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1; // loop's i++ lands past '*/'
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i + 2);
      i = end === -1 ? source.length : end - 1; // loop's i++ lands on '\n'
      continue;
    }

    if (ch === '<' && source.slice(i, i + 4) === '<!--') {
      const end = source.indexOf('-->', i + 4);
      i = end === -1 ? source.length : end + 2; // loop's i++ lands past '-->'
      continue;
    }

    result += ch;
  }

  return result;
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
    {
      label:
        'a /* inside a single-quoted string, paired with a later */ inside another string — the real colour literal between them must still be found',
      input: "const s = 'weird /* text'; color: '#eee'; const t = 'trailing */ end';",
      expected: ['#eee'],
    },
    {
      label:
        'a <!-- inside a string, paired with a later --> inside another string — the real colour literal between them must still be found',
      input: "const s = 'oops <!-- html'; color: '#eee'; const t = 'trailer --> end';",
      expected: ['#eee'],
    },
    {
      label:
        "a */ inside a string, before a genuine comment, does not disturb the comment's own scan",
      input: "const s = 'oops */ text'; /* a fake #123abc color, ignored */ color: '#fff';",
      expected: ['#fff'],
    },
    {
      label:
        "an escaped quote inside a string doesn't end it early, and a real colour literal after is found",
      input: "const s = 'it\\'s fine'; color: '#abc';",
      expected: ['#abc'],
    },
    {
      label: 'an unterminated /* consumes to end of input, hiding the colour literal it contains',
      input: '/* unterminated comment mentions #fff but never closes',
      expected: [],
    },
  ];

  it.each(cases)('$label', ({ input, expected }) => {
    expect(colourLiteralsIn(input)).toEqual(expected);
  });
});
