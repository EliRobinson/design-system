/* Where migrations come from, and which of them an upgrade actually crossed.
 *
 * Nothing in this module edits a file, which makes its failure mode quiet: it
 * selects the wrong set and every downstream verdict is correct about the wrong
 * migrations. There are two directions to get that wrong and they are not
 * symmetric. Selecting too many is survivable — a rename that has already been
 * applied finds nothing left to rename, and the rest is report-only. Selecting
 * too few is a consumer told "nothing to do" about a contrast bug they are
 * shipping. The interval tests below pin both ends of the half-open range for
 * that reason, and pin it against `sliceChangelog`'s: a migration and the
 * changelog entry describing it must never be selected apart.
 *
 * The other thing worth a test is the difference between "no manifest" and
 * "broken manifest". Both are a file that fails to yield migrations, and the
 * lazy implementation of both is `return null`. But a package that ships none
 * is the common case and not an error, while a manifest that exists and will
 * not parse is a corrupt install being silently reported as "nothing to do" —
 * the exact failure the `describeNpmFailure` convention in this CLI exists to
 * stop. So one returns null and the other throws a message naming the package,
 * the path, and what to do about it, and the test asserts the message rather
 * than just the throw, because an unactionable error is barely better than
 * silence.
 *
 * `readUpgradeRecord` goes the other way and must never throw at all: a
 * consumer can run `migrate` having never run the upgrade through this tool,
 * and a hand-edited or half-written record is their file, not our invariant.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectMigrations,
  MANIFEST_PATH,
  readManifest,
  readUpgradeRecord,
  resolveRange,
  selectMigrations,
  tokensOf,
  UPGRADE_RECORD_PATH,
} from './migrations.mjs';

/** A consuming repo with `name` installed, carrying whatever text is given as
 *  its manifest. Passing null installs the package without one. */
function makeConsumer(installs) {
  const cwd = mkdtempSync(join(tmpdir(), 'ds-migrations-'));

  for (const [name, manifest] of Object.entries(installs)) {
    const root = join(cwd, 'node_modules', ...name.split('/'));
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name }));
    if (manifest === null) continue;

    const path = join(root, MANIFEST_PATH);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  }

  return cwd;
}

const entry = (id, since, extra = {}) => ({
  id,
  since,
  kind: 'rename',
  from: [`--${id}`],
  ...extra,
});

describe('readManifest', () => {
  it('returns null when the package ships no manifest', () => {
    const cwd = makeConsumer({ '@elirobinson/react': null });

    expect(readManifest(cwd, '@elirobinson/react')).toBeNull();
  });

  it('returns null when the package is not installed at all', () => {
    expect(readManifest(makeConsumer({}), '@elirobinson/tokens')).toBeNull();
  });

  it('returns the parsed manifest', () => {
    const cwd = makeConsumer({
      '@elirobinson/tokens': { package: '@elirobinson/tokens', migrations: [entry('a', '0.9.0')] },
    });

    expect(readManifest(cwd, '@elirobinson/tokens')).toMatchObject({
      package: '@elirobinson/tokens',
      migrations: [expect.objectContaining({ id: 'a', since: '0.9.0' })],
    });
  });

  it('defaults the package field to the package it was read from', () => {
    const cwd = makeConsumer({ '@elirobinson/tokens': { migrations: [] } });

    expect(readManifest(cwd, '@elirobinson/tokens').package).toBe('@elirobinson/tokens');
  });

  it('returns null for a manifest with no migrations array', () => {
    const cwd = makeConsumer({ '@elirobinson/tokens': { package: '@elirobinson/tokens' } });

    expect(readManifest(cwd, '@elirobinson/tokens')).toBeNull();
  });

  /* A broken install reported as "nothing to do" is the worst outcome this
     module can produce, so the message has to be actionable, not just present. */
  it('throws an actionable error when the manifest exists but will not parse', () => {
    const cwd = makeConsumer({ '@elirobinson/tokens': '{ "migrations": [' });

    let thrown = null;
    try {
      readManifest(cwd, '@elirobinson/tokens');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toContain('@elirobinson/tokens');
    expect(thrown.message).toContain(MANIFEST_PATH);
    expect(thrown.message).toContain('not valid JSON');
    expect(thrown.message).toMatch(/re-install/i);
  });
});

describe('selectMigrations', () => {
  const MANIFEST = {
    migrations: [
      entry('older', '0.7.0'),
      entry('boundary-from', '0.8.0'),
      entry('crossed', '0.8.1'),
      entry('boundary-to', '0.9.0'),
      entry('newer', '1.0.0'),
    ],
  };

  const ids = (from, to) => selectMigrations(MANIFEST, from, to).map((item) => item.id);

  it.each([
    [
      'excludes the version you were on and includes the one you moved to',
      '0.8.0',
      '0.9.0',
      ['crossed', 'boundary-to'],
    ],
    [
      'takes everything up to the target when there is no record',
      null,
      '0.9.0',
      ['older', 'boundary-from', 'crossed', 'boundary-to'],
    ],
    ['has no upper bound when to is null', '0.8.1', null, ['boundary-to', 'newer']],
    [
      'takes the whole manifest when both ends are null',
      null,
      null,
      ['older', 'boundary-from', 'crossed', 'boundary-to', 'newer'],
    ],
    ['selects nothing when the range is empty', '0.9.0', '0.9.0', []],
  ])('%s', (_name, from, to, expected) => {
    expect(ids(from, to)).toEqual(expected);
  });

  it('drops an entry whose since cannot be parsed rather than throwing', () => {
    const manifest = { migrations: [entry('good', '0.9.0'), entry('bad', 'not-a-version')] };

    expect(selectMigrations(manifest, null, null).map((item) => item.id)).toEqual(['good']);
    expect(selectMigrations(manifest, '0.8.0', '0.9.0').map((item) => item.id)).toEqual(['good']);
  });
});

describe('tokensOf', () => {
  it('collects every token the selected migrations look for, without duplicates', () => {
    const tokens = tokensOf([{ from: ['--a', '--b'] }, { from: ['--b', '--c'] }]);

    expect(tokens).toEqual(new Set(['--a', '--b', '--c']));
  });

  it('is empty when nothing was selected', () => {
    expect(tokensOf([])).toEqual(new Set());
  });
});

describe('readUpgradeRecord', () => {
  it('reads what ds-resync --write left behind', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ds-record-'));
    const path = join(cwd, UPGRADE_RECORD_PATH);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ upgrades: { '@elirobinson/tokens': { from: '0.8.0' } } }));

    expect(readUpgradeRecord(cwd)).toEqual({ '@elirobinson/tokens': { from: '0.8.0' } });
  });

  it.each([
    ['no record at all', null],
    ['a corrupt record', '{ not json'],
    ['a record with no upgrades key', '{"version":1}'],
  ])('returns an empty record for %s', (_name, contents) => {
    const cwd = mkdtempSync(join(tmpdir(), 'ds-record-'));
    if (contents !== null) {
      const path = join(cwd, UPGRADE_RECORD_PATH);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    expect(readUpgradeRecord(cwd)).toEqual({});
  });
});

describe('resolveRange', () => {
  it.each([
    [
      'explicit flags beat everything else',
      {
        record: { from: '0.1.0', to: '0.2.0' },
        installedVersion: '0.9.0',
        explicitFrom: '0.5.0',
        explicitTo: '0.6.0',
      },
      { from: '0.5.0', to: '0.6.0' },
    ],
    [
      'the record supplies from, and node_modules supplies to',
      { record: { from: '0.8.0', to: '0.8.5' }, installedVersion: '0.9.0' },
      { from: '0.8.0', to: '0.9.0' },
    ],
    [
      'the record supplies to when nothing is installed',
      { record: { from: '0.8.0', to: '0.8.5' }, installedVersion: null },
      { from: '0.8.0', to: '0.8.5' },
    ],
    [
      'from is null with no record, which means consider everything',
      { record: undefined, installedVersion: '0.9.0' },
      { from: null, to: '0.9.0' },
    ],
    [
      'both ends are null when nothing is known',
      { record: undefined, installedVersion: null },
      { from: null, to: null },
    ],
  ])('%s', (_name, input, expected) => {
    expect(resolveRange({ explicitFrom: null, explicitTo: null, ...input })).toEqual(expected);
  });
});

describe('collectMigrations', () => {
  const MANIFEST = {
    package: '@elirobinson/tokens',
    migrations: [entry('old', '0.8.0'), entry('crossed', '0.9.0')],
  };

  const REACT_MANIFEST = { package: '@elirobinson/react', migrations: [entry('r', '2.0.0')] };

  it('collects only the range the record names', () => {
    const cwd = makeConsumer({ '@elirobinson/tokens': MANIFEST });

    expect(
      collectMigrations({
        cwd,
        packages: [{ name: '@elirobinson/tokens', installedVersion: '0.9.0' }],
        record: { '@elirobinson/tokens': { from: '0.8.0', to: '0.9.0' } },
      }),
    ).toEqual([
      {
        name: '@elirobinson/tokens',
        from: '0.8.0',
        to: '0.9.0',
        installedVersion: '0.9.0',
        migrations: [expect.objectContaining({ id: 'crossed' })],
      },
    ]);
  });

  it('skips a package outside the scope', () => {
    const cwd = makeConsumer({ next: MANIFEST });

    expect(
      collectMigrations({
        cwd,
        packages: [{ name: 'next', installedVersion: '15.3.1' }],
        record: {},
      }),
    ).toEqual([]);
  });

  it('skips a scoped package that ships no manifest', () => {
    const cwd = makeConsumer({ '@elirobinson/react': null, '@elirobinson/tokens': MANIFEST });

    const names = collectMigrations({
      cwd,
      packages: [
        { name: '@elirobinson/react', installedVersion: '2.0.1' },
        { name: '@elirobinson/tokens', installedVersion: '0.9.0' },
      ],
      record: {},
    }).map((item) => item.name);

    expect(names).toEqual(['@elirobinson/tokens']);
  });

  it('honours only', () => {
    const cwd = makeConsumer({
      '@elirobinson/react': REACT_MANIFEST,
      '@elirobinson/tokens': MANIFEST,
    });

    const names = collectMigrations({
      cwd,
      packages: [
        { name: '@elirobinson/react', installedVersion: '2.0.1' },
        { name: '@elirobinson/tokens', installedVersion: '0.9.0' },
      ],
      record: {},
      only: ['@elirobinson/tokens'],
    }).map((item) => item.name);

    expect(names).toEqual(['@elirobinson/tokens']);
  });

  it('considers every published migration when there is no record', () => {
    const cwd = makeConsumer({ '@elirobinson/tokens': MANIFEST });

    const [collected] = collectMigrations({
      cwd,
      packages: [{ name: '@elirobinson/tokens', installedVersion: '0.9.0' }],
      record: {},
    });

    expect(collected.from).toBeNull();
    expect(collected.migrations.map((item) => item.id)).toEqual(['old', 'crossed']);
  });
});

/* A record nobody validated on the way in.
 *
 * `readUpgradeRecord` promises never to throw on `.claude/ds-resync.json` — it
 * is a file on the consumer's disk and a corrupt one is not a reason to refuse
 * to migrate. Honouring that promise only as far as JSON.parse and then handing
 * the contents to `compareVersions` broke it one frame further down, with an
 * error naming neither the file nor the field. An end that cannot be parsed is
 * an end that is not known, which is a case the command already handles.
 */
describe('a hand-edited upgrade record cannot crash the run', () => {
  it.each([
    ['a range instead of a version', '^0.8.0'],
    ['a dist-tag', 'latest'],
    ['an empty string', ''],
    ['a number', 42],
  ])('drops %s from the record rather than throwing', (_what, value) => {
    expect(() =>
      resolveRange({ record: { from: value }, installedVersion: '0.9.0' }),
    ).not.toThrow();
    expect(resolveRange({ record: { from: value }, installedVersion: '0.9.0' }).from).toBeNull();
  });

  it('still selects migrations when the range came back unusable', () => {
    const manifest = { migrations: [{ id: 'a', since: '0.9.0' }] };
    expect(() => selectMigrations(manifest, '^0.8.0', '0.9.0')).not.toThrow();
    expect(selectMigrations(manifest, '^0.8.0', '0.9.0')).toHaveLength(1);
  });
});
