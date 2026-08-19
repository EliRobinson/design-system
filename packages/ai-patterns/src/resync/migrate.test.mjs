/* The engine that turns "this token moved" into an edit, or refuses to.
 *
 * These tests deliberately do NOT read `@elirobinson/tokens`' manifest. The
 * fixture test next door already proves the engine against the real one, and it
 * has to — a hand-written manifest would only prove the engine works on a
 * manifest nobody ships. What that leaves uncovered is the opposite risk: the
 * engine's rules quietly becoming a description of whatever six entries tokens
 * happens to publish today. Every migration below is therefore invented, so a
 * rule can be pinned in isolation and stays pinned after the manifest is
 * rewritten.
 *
 * The rule that most needs pinning is precedence, because it has already been
 * wrong once in a way no test noticed. An earlier draft let `review` beat
 * `rewrite` unconditionally, which reads like the conservative choice and is
 * not: a blanket "this colour moved" entry matches every occurrence of the
 * token, so it suppressed the specific "on a border, rename it" entry and the
 * tool shipped a report asking a human to hand-fix the exact thing it knew how
 * to fix. Specificity first, review only among equals — the `decide` cases below
 * fail loudly in both directions if that inverts again.
 *
 * The other class of bug here is arithmetic. `rewriteSource` edits by offset, so
 * applying two rewrites on one line left-to-right silently shifts the second by
 * the length delta of the first — a corruption that looks like a scanner bug and
 * is not. Three replacements of three different lengths on a single line is the
 * cheapest assertion that catches it.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectFiles,
  decide,
  formatMigrateReport,
  REVIEW_REASONS,
  rewriteSource,
  runMigrate,
  specificityOf,
  verdictFor,
} from './migrate.mjs';

/** A rename that is wrong everywhere, so it needs no context to be safe. */
const PLAIN_RENAME = {
  id: 'plain-rename',
  kind: 'rename',
  from: ['--old'],
  to: '--new',
  report: 'occurrence',
  reason: 'the old name was named for a ramp that no longer exists',
  guidance: 'A straight rename.',
};

/** A rename that is only correct on an edge — the shape that makes this tool
 *  worth having, and the shape a blind codemod gets wrong. */
const SCOPED_RENAME = {
  id: 'scoped-rename',
  kind: 'rename',
  from: ['--old'],
  to: '--old-border',
  when: { properties: ['border-color'] },
  report: 'occurrence',
  reason: 'the fill cannot carry a 3:1 line',
  guidance: 'Keep the fill. Move only the edge.',
};

/** Same colour, same name, different value: nothing to rewrite, ever. */
const REPOINT = {
  id: 'broad-repoint',
  kind: 'repoint',
  from: ['--old'],
  to: null,
  when: {},
  report: 'occurrence',
  reason: 'status used to be made of brand',
  guidance: 'Decide which one you meant.',
};

const REMOVED = {
  id: 'gone',
  kind: 'removed',
  from: ['--old'],
  to: null,
  report: 'occurrence',
  guidance: 'Pick a replacement by hand.',
};

/** Only a human can pick the state, so this never rewrites even though it
 *  knows exactly which token it is talking about. */
const ON_FILL = {
  id: 'on-fill',
  kind: 'review',
  from: ['--fg'],
  to: '--status-<state>-on',
  when: {
    properties: ['color'],
    blockMentions: ['--status-warning'],
    blockProperties: ['background'],
  },
  report: 'occurrence',
  guidance: 'Use the -on token of whichever fill this text sits on.',
};

const occurrence = (overrides = {}) => ({
  token: '--old',
  property: 'border-color',
  inCustomProperty: false,
  blockDeclarations: [],
  ...overrides,
});

describe('verdictFor', () => {
  it('rewrites an unconstrained rename anywhere', () => {
    expect(verdictFor(PLAIN_RENAME, occurrence({ property: 'background' }))).toEqual({
      verdict: 'rewrite',
      to: '--new',
    });
    expect(verdictFor(PLAIN_RENAME, occurrence({ property: null }))).toEqual({
      verdict: 'rewrite',
      to: '--new',
    });
  });

  it('rewrites a scoped rename on a listed property', () => {
    expect(verdictFor(SCOPED_RENAME, occurrence({ property: 'border-color' }))).toEqual({
      verdict: 'rewrite',
      to: '--old-border',
    });
  });

  it('ignores a scoped rename on a property it is not about', () => {
    expect(verdictFor(SCOPED_RENAME, occurrence({ property: 'background' }))).toEqual({
      verdict: 'ignore',
    });
  });

  it('reviews a scoped rename when the property could not be established', () => {
    expect(verdictFor(SCOPED_RENAME, occurrence({ property: null }))).toEqual({
      verdict: 'review',
      reason: REVIEW_REASONS.unknownProperty,
    });
  });

  it('reviews rather than rewriting through the consumer’s own custom property', () => {
    const aliased = occurrence({ property: '--app-edge', inCustomProperty: true });

    expect(verdictFor(PLAIN_RENAME, aliased)).toEqual({
      verdict: 'review',
      reason: REVIEW_REASONS.aliased,
    });
    expect(verdictFor(SCOPED_RENAME, aliased)).toEqual({
      verdict: 'review',
      reason: REVIEW_REASONS.aliased,
    });
  });

  it.each([
    ['repoint', REPOINT, REVIEW_REASONS.valueChanged],
    ['removed', REMOVED, REVIEW_REASONS.removed],
  ])('always reviews a %s, whatever the property is', (_kind, migration, reason) => {
    expect(verdictFor(migration, occurrence({ property: 'background' }))).toEqual({
      verdict: 'review',
      reason,
    });
    expect(verdictFor(migration, occurrence({ property: null }))).toEqual({
      verdict: 'review',
      reason,
    });
  });

  it('reviews a kind: review migration on a block that really does paint the fill', () => {
    const painted = occurrence({
      token: '--fg',
      property: 'color',
      blockDeclarations: [
        { token: '--status-warning', property: 'background' },
        { token: '--fg', property: 'color' },
      ],
    });

    expect(verdictFor(ON_FILL, painted)).toEqual({
      verdict: 'review',
      reason: REVIEW_REASONS.contextual,
    });
  });

  it('ignores a blockMentions migration when the block mentions nothing relevant', () => {
    const plain = occurrence({
      token: '--fg',
      property: 'color',
      blockDeclarations: [{ token: '--bg-inverse', property: 'background' }],
    });

    expect(verdictFor(ON_FILL, plain)).toEqual({ verdict: 'ignore' });
  });

  /* The precision case, and the one that decides whether anybody leaves the
     tool switched on: the status token IS in this block, but on the border. No
     status fill is painted here, so there is nothing to say about the colour. */
  it('ignores a blockMentions migration when the mention is on the wrong property', () => {
    const edgeOnly = occurrence({
      token: '--fg',
      property: 'color',
      blockDeclarations: [
        { token: '--status-warning', property: 'border-color' },
        { token: '--fg', property: 'color' },
      ],
    });

    expect(verdictFor(ON_FILL, edgeOnly)).toEqual({ verdict: 'ignore' });
  });
});

describe('specificityOf', () => {
  it.each([
    ['no constraints at all', {}, 0],
    ['an empty when block', { when: {} }, 0],
    ['one constraint', { when: { properties: ['color'] } }, 1],
    ['the other constraint', { when: { blockMentions: ['--status-warning'] } }, 1],
    ['both constraints', { when: { properties: ['color'], blockMentions: ['--x'] } }, 2],
  ])('scores %s as %s', (_name, migration, expected) => {
    expect(specificityOf(migration)).toBe(expected);
  });
});

describe('decide', () => {
  const onABorder = occurrence({ property: 'border-color' });

  /* The regression that names this file. A blanket repoint matches every
     occurrence of the token and always wants a human; the scoped rename knows
     exactly what to do on a border. If review won here, every warning edge in
     the consumer's repo would come back untouched with a note asking them to
     look at it. */
  it.each([
    ['broad first', [REPOINT, SCOPED_RENAME]],
    ['narrow first', [SCOPED_RENAME, REPOINT]],
  ])('lets a narrow rename beat a broad repoint (%s)', (_order, migrations) => {
    const [decision] = decide(migrations, [onABorder]);

    expect(decision).toMatchObject({
      verdict: 'rewrite',
      to: '--old-border',
    });
    expect(decision.migration.id).toBe('scoped-rename');
  });

  it('still reviews the broad repoint where the narrow rename does not apply', () => {
    const [decision] = decide([REPOINT, SCOPED_RENAME], [occurrence({ property: 'background' })]);

    expect(decision).toMatchObject({ verdict: 'review', reason: REVIEW_REASONS.valueChanged });
    expect(decision.migration.id).toBe('broad-repoint');
  });

  /* Equally narrow is the only place the "review wins" rule applies. Order must
     not decide it, so both orders are asserted. */
  const NARROW_REVIEW = { ...REMOVED, id: 'narrow-review', when: { properties: ['border-color'] } };
  const NARROW_REWRITE = { ...SCOPED_RENAME, id: 'narrow-rewrite' };

  it.each([
    ['review first', [NARROW_REVIEW, NARROW_REWRITE]],
    ['rewrite first', [NARROW_REWRITE, NARROW_REVIEW]],
  ])('lets review win among equally narrow migrations (%s)', (_order, migrations) => {
    const [decision] = decide(migrations, [onABorder]);

    expect(decision.verdict).toBe('review');
    expect(decision.migration.id).toBe('narrow-review');
  });

  it('produces no decision for an occurrence nothing matches', () => {
    expect(decide([PLAIN_RENAME], [occurrence({ token: '--unrelated' })])).toEqual([]);
    expect(decide([SCOPED_RENAME], [occurrence({ property: 'background' })])).toEqual([]);
    expect(decide([], [onABorder])).toEqual([]);
  });
});

describe('rewriteSource', () => {
  /* One line, three tokens, three replacements of three different lengths. Left
     to right this comes out mangled; right to left it comes out correct, and
     nothing else distinguishes the two implementations. */
  const LINE = '.a { border-color: var(--one); background: var(--two); color: var(--three); }';

  const decisionsFor = () => {
    const migrations = [
      { id: 'a', kind: 'rename', from: ['--one'], to: '--a' },
      { id: 'b', kind: 'rename', from: ['--two'], to: '--second-fill' },
      { id: 'c', kind: 'rename', from: ['--three'], to: '--tri' },
    ];
    const occurrences = ['--one', '--two', '--three'].map((token) => {
      const offset = LINE.indexOf(token);
      return { token, offset, end: offset + token.length, property: null, blockDeclarations: [] };
    });
    return decide(migrations, occurrences);
  };

  it('applies every rewrite on one line correctly', () => {
    expect(rewriteSource(LINE, decisionsFor())).toBe(
      '.a { border-color: var(--a); background: var(--second-fill); color: var(--tri); }',
    );
  });

  it('is unaffected by the order the decisions arrive in', () => {
    const forwards = rewriteSource(LINE, decisionsFor());
    const backwards = rewriteSource(LINE, [...decisionsFor()].reverse());

    expect(backwards).toBe(forwards);
  });

  it('leaves review decisions untouched', () => {
    const reviews = decisionsFor().map((decision) => ({
      ...decision,
      verdict: 'review',
      reason: REVIEW_REASONS.valueChanged,
    }));

    expect(rewriteSource(LINE, reviews)).toBe(LINE);
    expect(rewriteSource(LINE, [])).toBe(LINE);
  });
});

describe('collectFiles', () => {
  const makeTree = () => {
    const root = mkdtempSync(join(tmpdir(), 'ds-collect-'));

    writeFileSync(join(root, 'globals.css'), '');
    mkdirSync(join(root, 'app'), { recursive: true });
    writeFileSync(join(root, 'app', 'Alert.tsx'), '');
    writeFileSync(join(root, 'app', 'README.md'), '');

    for (const generated of ['node_modules', 'dist', '.next']) {
      mkdirSync(join(root, generated), { recursive: true });
      writeFileSync(join(root, generated, 'bundle.css'), '');
    }

    return root;
  };

  it('picks up the extensions a token can be referenced from', () => {
    const found = collectFiles(makeTree()).map((path) => path.split('/').pop());

    expect(found).toContain('globals.css');
    expect(found).toContain('Alert.tsx');
    expect(found).not.toContain('README.md');
  });

  it.each(['node_modules', 'dist', '.next'])('never walks into %s', (directory) => {
    const found = collectFiles(makeTree());

    expect(found.some((path) => path.includes(`/${directory}/`))).toBe(false);
  });

  it('returns nothing for a path that is not a directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'ds-collect-'));
    const file = join(root, 'globals.css');
    writeFileSync(file, '');

    expect(collectFiles(file)).toEqual([]);
    expect(collectFiles(join(root, 'nowhere'))).toEqual([]);
  });
});

describe('runMigrate', () => {
  const CWD = '/repo';
  const CSS = '.a { border-color: var(--old); }';

  /** Injectable IO, so the engine is exercised with no disk involved at all. */
  const harness = (migrations, options = {}) => {
    const written = [];
    const result = runMigrate({
      cwd: CWD,
      packages: [{ name: '@elirobinson/tokens', from: '0.8.0', to: '0.9.0', migrations }],
      files: [join(CWD, 'app.css')],
      read: () => CSS,
      writeFile: (path, contents) => written.push({ path, contents }),
      ...options,
    });
    return { result, written };
  };

  it('reports a rewrite without touching the file when write is false', () => {
    const { result, written } = harness([SCOPED_RENAME]);

    expect(written).toHaveLength(0);
    expect(result.filesScanned).toBe(1);
    expect(result.filesChanged).toBe(0);
    expect(result.wrote).toBe(false);
    expect(result.rewrites).toEqual([
      expect.objectContaining({
        file: 'app.css',
        line: 1,
        column: 24,
        token: '--old',
        to: '--old-border',
        migration: 'scoped-rename',
        package: '@elirobinson/tokens',
        property: 'border-color',
      }),
    ]);
  });

  it('writes through the injected writer when write is true', () => {
    const { result, written } = harness([SCOPED_RENAME], { write: true });

    expect(written).toEqual([
      { path: join(CWD, 'app.css'), contents: '.a { border-color: var(--old-border); }' },
    ]);
    expect(result.filesChanged).toBe(1);
    expect(result.wrote).toBe(true);
  });

  it('says nothing at all about a report: none migration', () => {
    const { result } = harness([{ ...REPOINT, report: 'none' }]);

    expect(result.rewrites).toEqual([]);
    expect(result.review).toEqual([]);
    expect(result.summary).toEqual([]);
    expect(result.filesScanned).toBe(1);
  });

  it('counts a report: summary migration instead of listing it', () => {
    const { result } = harness([{ ...REPOINT, report: 'summary' }]);

    expect(result.review).toEqual([]);
    expect(result.rewrites).toEqual([]);
    expect(result.summary).toEqual([
      expect.objectContaining({
        migration: 'broad-repoint',
        package: '@elirobinson/tokens',
        count: 1,
        guidance: 'Decide which one you meant.',
      }),
    ]);
  });

  it('carries the reason and the guidance onto a review', () => {
    const { result } = harness([REPOINT]);

    expect(result.rewrites).toEqual([]);
    expect(result.review).toEqual([
      expect.objectContaining({
        token: '--old',
        reason: REVIEW_REASONS.valueChanged,
        guidance: 'Decide which one you meant.',
        why: 'status used to be made of brand',
      }),
    ]);
  });

  it('does no work when no package ships a migration', () => {
    const result = runMigrate({
      cwd: CWD,
      packages: [],
      files: [join(CWD, 'app.css')],
      read: () => CSS,
      writeFile: () => {
        throw new Error('should not write');
      },
    });

    expect(result.filesScanned).toBe(0);
    expect(result.packages).toEqual([]);
  });

  it('survives a file it cannot read', () => {
    const result = runMigrate({
      cwd: CWD,
      packages: [
        { name: '@elirobinson/tokens', from: null, to: '0.9.0', migrations: [PLAIN_RENAME] },
      ],
      files: [join(CWD, 'gone.css'), join(CWD, 'app.css')],
      read: (path) => {
        if (path.endsWith('gone.css')) throw new Error('ENOENT');
        return CSS;
      },
      writeFile: () => {},
    });

    expect(result.filesScanned).toBe(1);
    expect(result.rewrites).toHaveLength(1);
  });
});

describe('formatMigrateReport', () => {
  const report = (migrations, options = {}) =>
    formatMigrateReport(
      runMigrate({
        cwd: '/repo',
        packages: [{ name: '@elirobinson/tokens', from: '0.8.0', to: '0.9.0', migrations }],
        files: ['/repo/app/globals.css'],
        read: () => '.a { border-color: var(--old); }',
        writeFile: () => {},
        ...options,
      }),
    );

  it('names the file, line and column of a rewrite', () => {
    const text = report([SCOPED_RENAME]);

    expect(text).toContain('app/globals.css:1:24  --old → --old-border');
    expect(text).toContain('Would rewrite 1:');
    expect(text).toContain('ds-resync migrate --write');
  });

  it('says it rewrote rather than would rewrite once it has written', () => {
    expect(report([SCOPED_RENAME], { write: true })).toContain('Rewrote 1:');
  });

  it('prints the guidance next to the line left for a human', () => {
    const text = report([REPOINT]);

    expect(text).toContain('1 left for you — not rewritten, on purpose:');
    expect(text).toContain(`why not: ${REVIEW_REASONS.valueChanged}`);
    expect(text).toContain('Decide which one you meant.');
  });

  it('points a consumer below 0.9.0 at the changelog instead', () => {
    const text = formatMigrateReport(
      runMigrate({ cwd: '/repo', packages: [], files: [], read: () => '', writeFile: () => {} }),
    );

    expect(text).toContain('No @elirobinson package here ships a migration manifest.');
    expect(text).toContain('@elirobinson/tokens from 0.9.0');
  });

  it('says so plainly when the range crosses no migrations', () => {
    expect(report([])).toContain('No migrations fall in that range. Nothing to do.');
  });
});
