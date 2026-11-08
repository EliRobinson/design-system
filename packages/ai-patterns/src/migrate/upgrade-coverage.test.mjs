/* upgrade.md cannot drift from the changelogs, the pending changesets or the token
 * migration manifest (#322, #334). The rules, and why, are in
 * scripts/upgrade-coverage.mjs; this suite runs them on this repo. Its unit tests and the
 * PR-to-release run are in scripts/upgrade-coverage.release.test.mjs.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  coverage,
  migrationCoverage,
  PENDING,
  readCoverageInputs,
} from '../../scripts/upgrade-coverage.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);

const { entries, released, pending, nextVersions } = await readCoverageInputs(root);
const tokenMigrations = JSON.parse(
  readFileSync(require.resolve('@elirobinson/tokens/migrations'), 'utf8'),
);

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
      expect(entry, entry.heading).toMatchObject({
        pkg: expect.stringMatching(/^@elirobinson\//),
        ...shape,
      });
    }
  });

  it('has unique headings', () => {
    const ids = entries.map((entry) => entry.heading);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('covers every breaking change, released or pending, and invents none', () => {
    expect(coverage({ entries, released, pending })).toEqual({
      missing: [],
      invented: [],
      nearMarker: [],
    });
  });

  it('is stamped by the release script, right after changeset version', () => {
    const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(scripts['changeset:version']).toBe(
      'changeset version && node packages/ai-patterns/scripts/stamp-upgrade.mjs',
    );
  });

  it('covers every token migration that is not silent, and names none twice', () => {
    expect(migrationCoverage(entries, tokenMigrations.migrations)).toEqual({
      missing: [],
      unknown: [],
      duplicated: [],
    });
    for (const entry of entries.filter((e) => e.migration)) {
      const migration = tokenMigrations.migrations.find((m) => m.id === entry.migration);
      const version = entry.version === PENDING ? nextVersions.get(entry.pkg) : entry.version;
      expect(entry.pkg, entry.heading).toBe(tokenMigrations.package);
      expect(version, entry.heading).toBe(migration.since);
    }
  });
});
