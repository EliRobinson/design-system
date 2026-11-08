/* upgrade.md cannot drift from the changelogs or from the token migration manifest (#322).
 *
 * upgrade.md has one section per breaking change. Each names the package, the version it
 * broke in and the changeset that broke it. This suite holds the two directions:
 *
 * - Nothing missing. Every changeset under `### Major Changes`, and every 0.x minor
 *   changeset that calls itself breaking (on 0.x, minor is the breaking lane), is covered
 *   by an entry or sits in NOT_BREAKING with a reason. Every entry in
 *   `@elirobinson/tokens/migrations` is covered by exactly one entry, except a silent one
 *   (`report: "none"`), which may have one.
 * - Nothing invented. Every entry's changeset is in that package's changelog, under that
 *   version, and every token migration it names exists, with the same `since`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseChangelog, parseChangesetEntries } from '../resync/changelog.mjs';
import { parseVersion } from '../resync/semver.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(here, '..', '..', '..');
const require = createRequire(import.meta.url);

/* A package's share of a changeset the rule picks up that does not break that package's
   consumers, keyed `<package> <hash>`. Each needs a reason, and one that stops matching
   fails the suite, so this cannot grow stale. */
const NOT_BREAKING = {
  '@elirobinson/tokens 0f09b17':
    'Adds the token migration manifest. Nothing a consumer wrote stops working; the word is about the palette release before it.',
  '@elirobinson/ai-patterns 0f09b17': 'Adds `ds-resync migrate`. Additive.',
  '@elirobinson/eslint-config 0f09b17':
    'Adds the lint rule that reads the migration manifest. Additive.',
  '@elirobinson/ai-patterns a6f2796':
    'Adds `ds-resync --only/--target`. The word describes the consumer majors this helps defer, not this change.',
  '@elirobinson/ai-patterns 8938d09':
    'ai-patterns only followed the token split. The breaking parts ship in @elirobinson/tokens 0.9.0 and each has its own section.',
  '@elirobinson/ai-patterns 2c3c5e7':
    'Adds the `./corpus` export. The breaking part, the removed manifest field, is @elirobinson/react 2.0.0 and has its section.',
  '@elirobinson/ai-patterns 761aecd':
    'Adds the ds-migrate skill and its `./migrate/*.md` export. Additive; the word describes the breaking changes this test catches.',
  '@elirobinson/tokens b0d68d7':
    'tokens only grew a hit area and used `--target-min`. The break is in the ai-patterns checks, which has its section.',
};

/* One changeset can ship in several packages and break only some of them, so coverage is
   per package. */
const key = (pkg, hash) => `${pkg} ${hash}`;

/** Every changeset in every package changelog in the workspace. */
function changesets() {
  return readdirSync(packagesDir)
    .filter((dir) => existsSync(join(packagesDir, dir, 'CHANGELOG.md')))
    .flatMap((dir) => {
      const pkg = JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')).name;
      const text = readFileSync(join(packagesDir, dir, 'CHANGELOG.md'), 'utf8');
      return parseChangelog(text).flatMap(({ version, body }) =>
        parseChangesetEntries(body).map((entry) => ({ pkg, version, ...entry })),
      );
    });
}

/* Not ds-resync's rule. ds-resync labels a whole version jump, so it calls every 0.x
   minor breaking, which is right for "should I be careful upgrading". This file lists
   changes, and most 0.x minors are additive: holding each one to a section would bury the
   real ones. So a 0.x minor counts when its own author says it breaks, which is how this
   repo writes them (see 84aef19, b0d68d7), and NOT_BREAKING answers the false hits. */
function needsSection({ version, section, text }) {
  if (section === 'Major Changes') return true;
  return (
    parseVersion(version).major === 0 &&
    section === 'Minor Changes' &&
    /\bbreak(?:ing|s)\b/i.test(text)
  );
}

/** @returns {{ id: string, pkg?: string, version?: string, hash?: string, migration?: string }[]} */
function upgradeEntries() {
  const text = readFileSync(join(here, 'upgrade.md'), 'utf8');
  const field = (section, name) => section.match(new RegExp(`^- ${name}: \`([^\`]+)\``, 'm'))?.[1];
  return text
    .split(/^## /m)
    .slice(1)
    .filter((section) => /^- Package: /m.test(section))
    .map((section) => ({
      id: section.split('\n')[0].trim(),
      pkg: field(section, 'Package'),
      version: field(section, 'Version'),
      hash: field(section, 'Changeset'),
      migration: field(section, 'Token migration'),
    }));
}

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

const all = changesets();
const entries = upgradeEntries();
const tokenMigrations = JSON.parse(
  readFileSync(require.resolve('@elirobinson/tokens/migrations'), 'utf8'),
);

describe('upgrade.md', () => {
  it('has entries, each naming a package, a version and a changeset', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry, entry.id).toMatchObject({
        pkg: expect.stringMatching(/^@elirobinson\//),
        version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
        hash: expect.stringMatching(/^[0-9a-f]{7}$/),
      });
    }
  });

  it('has unique entry ids', () => {
    const ids = entries.map((entry) => entry.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('covers every breaking changeset in every package it ships in', () => {
    const covered = new Set([
      ...entries.map((entry) => key(entry.pkg, entry.hash)),
      ...Object.keys(NOT_BREAKING),
    ]);
    const missing = all
      .filter(needsSection)
      .filter((cs) => !covered.has(key(cs.pkg, cs.hash)))
      .map((cs) => `${key(cs.pkg, cs.hash)} (${cs.version}): ${cs.text.split('\n')[0]}`);
    expect(missing).toEqual([]);
  });

  it('keeps NOT_BREAKING to changesets the rule still flags', () => {
    const flagged = new Set(all.filter(needsSection).map((cs) => key(cs.pkg, cs.hash)));
    expect(Object.keys(NOT_BREAKING).filter((k) => !flagged.has(k))).toEqual([]);
  });

  it('names only changesets that exist, in that package, under that version', () => {
    const invented = entries
      .filter(
        (entry) =>
          !all.some(
            (cs) => cs.pkg === entry.pkg && cs.version === entry.version && cs.hash === entry.hash,
          ),
      )
      .map((entry) => `${entry.id}: ${entry.pkg}@${entry.version} has no changeset ${entry.hash}`);
    expect(invented).toEqual([]);
  });

  it('covers every token migration that is not silent, and names none twice', () => {
    expect(migrationCoverage(entries, tokenMigrations.migrations)).toEqual({
      missing: [],
      unknown: [],
      duplicated: [],
    });
    for (const entry of entries.filter((e) => e.migration)) {
      const migration = tokenMigrations.migrations.find((m) => m.id === entry.migration);
      expect(entry.pkg, entry.id).toBe(tokenMigrations.package);
      expect(entry.version, entry.id).toBe(migration.since);
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
