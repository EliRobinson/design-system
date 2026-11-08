/* upgrade.md cannot drift from the changelogs, the pending changesets or the token
 * migration manifest (#322, #334).
 *
 * upgrade.md has one section per breaking change. A released section names the package,
 * the version it broke in and the changelog hash. A pending one says `Version: pending`
 * and names the `.changeset/*.md` file, and the release fills both in (see
 * scripts/stamp-upgrade.mjs). This suite holds the two directions:
 *
 * - Nothing missing. Every `major` changeset, and every 0.x `minor` one whose text starts
 *   with `**Breaking:**`, released or pending, is covered by a section for each package
 *   it bumps. Every entry in `@elirobinson/tokens/migrations` is covered by exactly one
 *   section, except a silent one (`report: "none"`), which may have one.
 * - Nothing invented. Every section names a change that is there, and every token
 *   migration it names exists, with the same `since`.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { coverage, PENDING, readCoverageInputs } from '../../scripts/upgrade-coverage.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);

/* Which token migrations need a section. A silent one (`report: "none"`) renders the same
   and `ds-resync migrate` says nothing about it, so it breaks nothing a consumer wrote and
   needs no section; one may still have a section. Every other migration needs exactly one.
   tokens' migrations.test.mjs is what holds a silent entry to a repoint that renders the
   same, so this exemption cannot let a visible change through. */
function migrationCoverage(sections, migrations) {
  const named = sections.map((entry) => entry.migration).filter(Boolean);
  const ids = new Set(migrations.map((m) => m.id));
  return {
    missing: migrations
      .filter((m) => m.report !== 'none' && !named.includes(m.id))
      .map((m) => m.id),
    unknown: named.filter((id) => !ids.has(id)),
    duplicated: named.filter((id, i) => named.indexOf(id) !== i),
  };
}

const { entries, released, pending } = readCoverageInputs(root);
const tokenMigrations = JSON.parse(
  readFileSync(require.resolve('@elirobinson/tokens/migrations'), 'utf8'),
);

/* The version a pending change will ship in: the package's current version bumped by the
   largest pending bump for it, the way `changeset version` does it. */
function nextVersion(pkg) {
  const bumps = new Set(pending.filter((c) => c.pkg === pkg).map((c) => c.bump));
  const current = pending.find((c) => c.pkg === pkg).previous;
  const [major, minor, patch] = current.split('.').map(Number);
  if (bumps.has('major')) return `${major + 1}.0.0`;
  if (bumps.has('minor')) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

describe('upgrade.md', () => {
  it('has entries, each naming a package, a version and a changeset', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const shape =
        entry.version === PENDING
          ? { changeset: expect.stringMatching(/^[a-z0-9-]+$/) }
          : {
              version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
              changeset: expect.stringMatching(/^[0-9a-f]{7}$/),
            };
      expect(entry, entry.id).toMatchObject({
        pkg: expect.stringMatching(/^@elirobinson\//),
        ...shape,
      });
    }
  });

  it('has unique entry ids', () => {
    const ids = entries.map((entry) => entry.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('covers every breaking change, released or pending, and invents none', () => {
    expect(coverage({ entries, released, pending })).toEqual({ missing: [], invented: [] });
  });

  it('covers every token migration that is not silent, and names none twice', () => {
    expect(migrationCoverage(entries, tokenMigrations.migrations)).toEqual({
      missing: [],
      unknown: [],
      duplicated: [],
    });
    for (const entry of entries.filter((e) => e.migration)) {
      const migration = tokenMigrations.migrations.find((m) => m.id === entry.migration);
      const version = entry.version === PENDING ? nextVersion(entry.pkg) : entry.version;
      expect(entry.pkg, entry.id).toBe(tokenMigrations.package);
      expect(version, entry.id).toBe(migration.since);
    }
  });
});

describe('migrationCoverage', () => {
  const silent = { id: 'silent', report: 'none' };
  const loud = { id: 'loud', report: 'occurrence' };

  it('lets a silent migration go without a section', () => {
    expect(migrationCoverage([], [silent]).missing).toEqual([]);
  });

  it('still allows a section for a silent migration', () => {
    expect(migrationCoverage([{ migration: 'silent' }], [silent])).toEqual({
      missing: [],
      unknown: [],
      duplicated: [],
    });
  });

  it('fails a migration that reports something and has no section', () => {
    expect(migrationCoverage([], [silent, loud]).missing).toEqual(['loud']);
  });

  it('fails a section for a migration that does not exist, or one named twice', () => {
    const result = migrationCoverage(
      [{ migration: 'loud' }, { migration: 'loud' }, { migration: 'gone' }],
      [loud],
    );
    expect(result.unknown).toEqual(['gone']);
    expect(result.duplicated).toEqual(['loud']);
  });
});
