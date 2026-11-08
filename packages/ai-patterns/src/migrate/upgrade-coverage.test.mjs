/* upgrade.md cannot drift from the changelogs or from the token migration manifest (#322).
 *
 * upgrade.md has one section per breaking change. Each names the package, the version it
 * broke in and the changeset that broke it. This suite holds the two directions:
 *
 * - Nothing missing. Every changeset under `### Major Changes`, and every 0.x minor
 *   changeset that calls itself breaking (on 0.x, minor is the breaking lane), is covered
 *   by an entry or sits in NOT_BREAKING with a reason. Every entry in
 *   `@elirobinson/tokens/migrations` is covered by exactly one entry.
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

  it('covers every token migration exactly once, at the version it ships in', () => {
    const named = entries.filter((entry) => entry.migration);
    expect(named.map((entry) => entry.migration).sort()).toEqual(
      tokenMigrations.migrations.map((m) => m.id).sort(),
    );
    for (const entry of named) {
      const migration = tokenMigrations.migrations.find((m) => m.id === entry.migration);
      expect(entry.pkg, entry.id).toBe(tokenMigrations.package);
      expect(entry.version, entry.id).toBe(migration.since);
    }
  });
});
