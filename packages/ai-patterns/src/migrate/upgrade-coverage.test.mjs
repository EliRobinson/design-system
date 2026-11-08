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

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(here, '..', '..', '..');
const require = createRequire(import.meta.url);

/* A changeset the "breaking" heuristic picks up that does not break a consumer. Each one
   needs a reason, and one that stops matching fails the suite, so this cannot grow stale. */
const NOT_BREAKING = {
  '0f09b17':
    'Adds the token migration manifest and `ds-resync migrate`. Nothing a consumer wrote stops working; the word is about the palette release before it.',
  a6f2796:
    'Adds `ds-resync --only/--target`. The word describes the consumer majors this helps defer, not this change.',
};

/** @returns {{ pkg: string, version: string, heading: string, hash: string, body: string }[]} */
function changesets() {
  const found = [];
  for (const dir of readdirSync(packagesDir)) {
    let text;
    let pkg;
    try {
      text = readFileSync(join(packagesDir, dir, 'CHANGELOG.md'), 'utf8');
      pkg = JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')).name;
    } catch {
      continue;
    }
    for (const release of text.split(/^## /m).slice(1)) {
      const version = release.split('\n')[0].trim();
      for (const section of release.split(/^### /m).slice(1)) {
        const heading = section.split('\n')[0].trim();
        for (const entry of section.split(/^- (?=[0-9a-f]{7}:)/m).slice(1)) {
          found.push({ pkg, version, heading, hash: entry.slice(0, 7), body: entry });
        }
      }
    }
  }
  return found;
}

function isBreaking({ version, heading, body }) {
  if (heading === 'Major Changes') return true;
  return (
    version.startsWith('0.') && heading === 'Minor Changes' && /\bbreak(?:ing|s)\b/i.test(body)
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

  it('covers every breaking changeset, or says why one is not breaking', () => {
    const covered = new Set([...entries.map((entry) => entry.hash), ...Object.keys(NOT_BREAKING)]);
    const missing = all
      .filter(isBreaking)
      .filter((cs) => !covered.has(cs.hash))
      .map((cs) => `${cs.pkg}@${cs.version} ${cs.hash}: ${cs.body.split('\n')[0].slice(9, 90)}`);
    expect(missing).toEqual([]);
  });

  it('keeps NOT_BREAKING to changesets the heuristic still flags', () => {
    const flagged = new Set(all.filter(isBreaking).map((cs) => cs.hash));
    expect(Object.keys(NOT_BREAKING).filter((hash) => !flagged.has(hash))).toEqual([]);
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
