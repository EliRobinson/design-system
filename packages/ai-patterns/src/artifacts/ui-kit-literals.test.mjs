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

/* Strips comments before matching, so a colour word or a `#nnn` cross-reference living
 * in prose never reads as a rendered literal. This is a single-pass character scanner,
 * not a pair of regexes, because a regex scan can't tell a comment delimiter that's
 * sitting inside a string or attribute value from a real comment opener — everything up
 * to the next closing delimiter would be silently dropped from what the guard checks,
 * including any real colour literal in between.
 *
 * One lexer cannot serve both languages the kits are written in, because JS and HTML
 * disagree about what a quote character means: in JS, `'`/`"`/backtick always delimit a
 * string, wherever they appear. In HTML, they delimit an attribute value only inside a
 * tag's `<…>` span — in text content (including inside a <style> block, which is text
 * content as far as the tag structure goes) an apostrophe is just prose. Mode is picked
 * per file by `withoutComments`, which dispatches to one of two scanners below.
 */
function withoutComments(source, file) {
  return modeFor(file) === 'html' ? withoutCommentsHtml(source) : withoutCommentsJs(source);
}

/** .html files scan in HTML mode; everything else (.jsx, or no filename given) is JS mode. */
function modeFor(file) {
  return typeof file === 'string' && /\.html$/i.test(file) ? 'html' : 'js';
}

/* JS/JSX mode. A single-quoted string, double-quoted string, or backtick template
 * literal is tracked from its opening quote to its closing quote (honouring backslash
 * escapes, so `'it\'s'` doesn't end early); `/*`, `//` and `<!--` inside one are ordinary
 * characters, not comment openers. Outside a string, `/* … *\/`, `// …` to end of line,
 * and `<!-- … -->` are all comments and are stripped. An unterminated comment (no closing
 * delimiter) consumes to end of input rather than throwing.
 */
function withoutCommentsJs(source) {
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

/* HTML mode. A `'` or `"` only opens an attribute-value string while inside a tag (from
 * the `<` that opens it to its matching `>`); the same character in text content —
 * including inside a <style> block's CSS, which is text content between the <style> and
 * </style> tags — is a literal character, so "don't" in prose can never open a string
 * that swallows the rest of the file. HTML has no backslash escaping, so a quote is
 * closed by the next occurrence of the same quote character, full stop. `<!-- … -->` and
 * `/* … *\/` (the latter for a <style> block's CSS comments) are comments anywhere
 * outside an attribute value — in text, inside a tag, or inside <style> content — and are
 * stripped; an unterminated one consumes to end of input rather than throwing. `//` is
 * deliberately NOT treated as a comment: it isn't one in HTML or CSS, and it appears in
 * every `https://` URL a kit links to.
 */
function withoutCommentsHtml(source) {
  let result = '';
  let inTag = false;
  let quote = null; // set only while inTag; the attribute value's quote character

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (quote) {
      result += ch;
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '<' && source.slice(i, i + 4) === '<!--') {
      const end = source.indexOf('-->', i + 4);
      i = end === -1 ? source.length : end + 2; // loop's i++ lands past '-->'
      continue;
    }

    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1; // loop's i++ lands past '*/'
      continue;
    }

    if (inTag) {
      if (ch === "'" || ch === '"') {
        quote = ch;
      } else if (ch === '>') {
        inTag = false;
      }
      result += ch;
      continue;
    }

    if (ch === '<') inTag = true;
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

/**
 * The detector under test: every colour-literal match found in `source`, comments
 * excluded. `file` (a path or bare filename) selects HTML mode for a `.html` file and JS
 * mode otherwise; the table test below calls this without a `file` for its bare-string
 * cases, which are all written as JS/CSS-in-JS snippets, so the default is JS mode — a
 * case meant to exercise HTML's tag-scoped quoting passes an explicit `'kit.html'`.
 */
export function colourLiteralsIn(source, file) {
  return withoutComments(source, file).match(COLOUR_LITERAL) ?? [];
}

describe('the shipped UI kits paint no colour literals', () => {
  const files = kitFiles();

  it('finds kit files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('$file', ({ source, file }) => {
    expect(colourLiteralsIn(source, file)).toEqual([]);
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
      file: 'kit.html',
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
      file: 'kit.html',
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
    {
      label:
        'in HTML mode, an apostrophe in prose is not a quote — it must not swallow the real comment that follows',
      input: "<p>don't</p><!-- #119 -->",
      file: 'kit.html',
      expected: [],
    },
    {
      label:
        'in HTML mode, an apostrophe in text content does not stop a later <style> literal from being found',
      input: "<p>it's fine</p><style>a{color:#abcdef}</style>",
      file: 'kit.html',
      expected: ['#abcdef'],
    },
    {
      label:
        'in HTML mode, an apostrophe in prose plus a real CSS comment in <style> both behave — only the un-commented literal is caught',
      input: "<p>it's ok</p><style>/* #fff */ a{color:#eee}</style>",
      file: 'kit.html',
      expected: ['#eee'],
    },
    {
      label:
        'in HTML mode, an attribute value legitimately containing an apostrophe and <!-- is preserved, and a later literal is still found',
      input: '<div title="don\'t" data-x="<!-- nope -->"></div><style>a{color:#123456}</style>',
      file: 'kit.html',
      expected: ['#123456'],
    },
  ];

  it.each(cases)('$label', ({ input, file, expected }) => {
    expect(colourLiteralsIn(input, file)).toEqual(expected);
  });
});
