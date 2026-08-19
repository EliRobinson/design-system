/* The scanner is the only thing standing between a codemod and a mangled repo.
 *
 * `migrate` never re-reads a file to check its own work: whatever `scanSource`
 * reports about an occurrence is what the rewrite is performed on, byte offset
 * and all. So the failures worth spending tests on are the ones that stay
 * invisible downstream — a name matched one character too long, a property read
 * off the wrong colon, a comment whose masking moved every offset after it. Each
 * of those produces a run that reports confidently and edits the wrong bytes,
 * and nothing later in the pipeline is in a position to notice.
 *
 * `tokenPattern` is the case worth naming. `--status-warning` is a PREFIX of
 * `--status-warning-border`, which is the token the migration rewrites to, so a
 * pattern without a terminator turns a correct run into one that migrates its
 * own output. That is asserted here with both names in the set and both in the
 * subject string, because a single-name negative assertion would still pass on
 * an implementation whose longest-first alternation had been lost.
 *
 * The rest of this file defends the null contract. `propertyAt` is ALLOWED to
 * fail, and every case here that expects null is protecting the caller's right
 * to downgrade a rewrite to a review — the ternary branch, the bare `var()`,
 * the offset that is not inside a declaration at all. A `propertyAt` that
 * guessed rather than returned null would make the tool quieter and wrong, which
 * is the one trade this module exists to refuse.
 */

import { describe, expect, it } from 'vitest';
import {
  blockAt,
  blockDeclarations,
  maskComments,
  normalizeProperty,
  positionAt,
  propertyAt,
  scanSource,
  tokenPattern,
} from './scan.mjs';

/** One property key in CSS, one in a JS style object, one already normal. */
describe('normalizeProperty', () => {
  it.each([
    ['borderColor', 'border-color'],
    ['WebkitTextFillColor', '-webkit-text-fill-color'],
    ['backgroundImage', 'background-image'],
    ['border-color', 'border-color'],
    ['Border-Color', 'border-color'],
    ['color', 'color'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeProperty(input)).toBe(expected);
  });

  it('leaves a custom property exactly as it was written', () => {
    expect(normalizeProperty('--custom-prop')).toBe('--custom-prop');
    expect(normalizeProperty('--appCalloutEdge')).toBe('--appCalloutEdge');
  });
});

describe('tokenPattern', () => {
  it('does not match a token inside a longer token that starts with it', () => {
    const pattern = tokenPattern(['--status-warning']);
    const longer = [
      'var(--status-warning-border)',
      'var(--status-warning-on)',
      'var(--status-warning-tint-edge)',
    ].join(' ');

    expect(longer.match(pattern)).toBeNull();
  });

  it('matches each name exactly once when one is a prefix of the other', () => {
    const pattern = tokenPattern(['--status-warning', '--status-warning-border']);
    const source =
      '.a { background: var(--status-warning); border-color: var(--status-warning-border); }';

    expect(source.match(pattern)).toEqual(['--status-warning', '--status-warning-border']);
  });

  it('is insensitive to the order the names are given in', () => {
    const source = 'var(--status-warning-border) var(--status-warning)';

    expect(source.match(tokenPattern(['--status-warning', '--status-warning-border']))).toEqual([
      '--status-warning-border',
      '--status-warning',
    ]);
    expect(source.match(tokenPattern(['--status-warning-border', '--status-warning']))).toEqual([
      '--status-warning-border',
      '--status-warning',
    ]);
  });
});

describe('propertyAt', () => {
  const at = (source, needle) => propertyAt(source, source.indexOf(needle));

  it('reads a CSS property', () => {
    expect(at('.a {\n  border-color: var(--status-warning);\n}\n', '--status-warning')).toBe(
      'border-color',
    );
  });

  it('reads and normalizes a JS style object key', () => {
    expect(at("const s = { borderColor: 'var(--status-warning)' };", '--status-warning')).toBe(
      'border-color',
    );
  });

  it('reads a quoted key', () => {
    expect(at("const s = { 'border-color': 'var(--status-warning)' };", '--status-warning')).toBe(
      'border-color',
    );
  });

  it('returns the custom property a value is being assigned to', () => {
    expect(at(':root {\n  --app-callout-edge: var(--status-warning);\n}\n', 'var(')).toBe(
      '--app-callout-edge',
    );
  });

  it('returns null for the second branch of a ternary', () => {
    const source = "color: hot ? 'var(--a)' : 'var(--b)'";

    // The first branch still reads off the real declaration.
    expect(at(source, '--a')).toBe('color');
    // The second one's nearest colon belongs to the ternary, not a declaration.
    expect(at(source, '--b')).toBeNull();
  });

  it.each([
    ['a bare reference with no declaration before it', 'var(--x)', '--x'],
    ['a reference after the declaration was terminated', 'color: red; var(--x)', '--x'],
    ['a reference just inside an opening brace', '.a { var(--x)', '--x'],
    ['a reference just after a closing brace', '.a { color: red } var(--x)', '--x'],
  ])('returns null for %s', (_name, source, needle) => {
    expect(at(source, needle)).toBeNull();
  });
});

describe('blockAt', () => {
  it('returns the innermost enclosing braces in CSS', () => {
    const source = '.a {\n  color: var(--x);\n}\n';
    expect(blockAt(source, source.indexOf('--x')).text).toBe('{\n  color: var(--x);\n}');
  });

  it('returns the innermost enclosing braces of a nested block', () => {
    const source = '@media (min-width: 40rem) {\n  .a {\n    color: var(--x);\n  }\n}\n';
    const block = blockAt(source, source.indexOf('--x'));

    expect(block.text).toBe('{\n    color: var(--x);\n  }');
    expect(block.text).not.toContain('@media');
  });

  it('returns the style object rather than the JSX expression container', () => {
    const source = "<div style={{ color: 'var(--fg-inverse)' }} />";
    expect(blockAt(source, source.indexOf('--fg-inverse')).text).toBe(
      "{ color: 'var(--fg-inverse)' }",
    );
  });

  it('returns null at the top level', () => {
    expect(blockAt('color: var(--x);', 12)).toBeNull();
  });
});

describe('blockDeclarations', () => {
  /* The pairing, not the mention, is the whole point: this block MENTIONS a
     status token, and paints its fill with something else entirely. A heuristic
     that only counted mentions reported the colour as sitting on a status fill,
     which is the false positive this function exists to prevent. */
  const CARD = `.card {
  background: var(--surface);
  border-color: var(--status-warning);
  color: var(--fg-inverse);
}
`;

  const declarations = () => blockDeclarations(CARD, blockAt(CARD, CARD.indexOf('--fg-inverse')));

  it('pairs every token in the block with the property it is a value of', () => {
    expect(declarations()).toEqual([
      { token: '--surface', property: 'background' },
      { token: '--status-warning', property: 'border-color' },
      { token: '--fg-inverse', property: 'color' },
    ]);
  });

  it('pairs a status token on an edge with the edge, never with the fill', () => {
    const status = declarations().filter((entry) => entry.token === '--status-warning');

    expect(status).toEqual([{ token: '--status-warning', property: 'border-color' }]);
    expect(status.some((entry) => entry.property === 'background')).toBe(false);
  });

  it('returns nothing for an offset that is in no block', () => {
    expect(blockDeclarations(CARD, null)).toEqual([]);
  });
});

describe('maskComments', () => {
  /* Blanking rather than deleting is the invariant every offset downstream
     depends on: the masked copy is searched, and the real file is rewritten at
     the offsets that search returns. A mask that changed the length by one byte
     would corrupt every edit after the first comment. */
  const SOURCE = `.a {
  /* a warning FILL is still
     --status-warning, do not touch */
  background: var(--status-warning);
}
`;

  it('preserves length and every newline', () => {
    const masked = maskComments(SOURCE);

    expect(masked.length).toBe(SOURCE.length);
    expect(masked.split('\n').length).toBe(SOURCE.split('\n').length);
  });

  it('blanks the body of a block comment', () => {
    const masked = maskComments(SOURCE);

    expect(masked).not.toContain('do not touch');
    expect(masked).toContain('background: var(--status-warning);');
  });

  it('blanks a line comment that starts a line, indentation aside', () => {
    const masked = maskComments('  // --status-warning here\nconst x = 1;\n');

    expect(masked).not.toContain('--status-warning');
    expect(masked).toContain('const x = 1;');
    expect(masked.startsWith('  ')).toBe(true);
  });

  it('leaves a mid-line // alone, because a URL is not a comment', () => {
    const source = 'background: url(https://example.com/hero.png);';

    expect(maskComments(source)).toBe(source);
  });
});

describe('positionAt', () => {
  it('counts lines and columns the way an editor does', () => {
    const source = 'one\ntwo\nthree';

    expect(positionAt(source, 0)).toEqual({ line: 1, column: 1 });
    expect(positionAt(source, source.indexOf('two'))).toEqual({ line: 2, column: 1 });
    expect(positionAt(source, source.indexOf('hree'))).toEqual({ line: 3, column: 2 });
  });
});

describe('scanSource', () => {
  it('reports a 1-based line and column an editor can be pointed at', () => {
    const source = '.a {\n  color: var(--status-warning);\n}\n';
    const [occurrence] = scanSource(source, 'app/globals.css', ['--status-warning']);

    expect(occurrence).toMatchObject({
      file: 'app/globals.css',
      token: '--status-warning',
      line: 2,
      column: 14,
      property: 'color',
      inCustomProperty: false,
      text: 'color: var(--status-warning);',
    });
    expect(source.slice(occurrence.offset, occurrence.end)).toBe('--status-warning');
  });

  it('skips a token that only appears in prose', () => {
    const source =
      '/* a warning FILL is still --status-warning */\n.a { color: var(--ink-500); }\n';

    expect(scanSource(source, 'a.css', ['--status-warning'])).toEqual([]);
  });

  it('flags a token aliased into the consumer’s own custom property', () => {
    const source = ':root {\n  --mine: var(--status-warning);\n}\n';
    const [occurrence] = scanSource(source, 'a.css', ['--status-warning']);

    expect(occurrence).toMatchObject({ property: '--mine', inCustomProperty: true });
  });

  it('carries the enclosing block’s declarations alongside each occurrence', () => {
    const source = '.t {\n  background: var(--status-danger);\n  color: var(--fg-inverse);\n}\n';
    const [occurrence] = scanSource(source, 'a.css', ['--fg-inverse']);

    expect(occurrence.blockDeclarations).toEqual([
      { token: '--status-danger', property: 'background' },
      { token: '--fg-inverse', property: 'color' },
    ]);
  });

  it('returns nothing when there is nothing to look for', () => {
    expect(scanSource('.a { color: var(--x); }', 'a.css', [])).toEqual([]);
  });
});
