/* The rules that hold upgrade.md to the changes it documents (#322, #334). The data
 * suite (src/migrate/upgrade-coverage.test.mjs) runs them on this repo,
 * upgrade-coverage.release.test.mjs runs them from a PR to its release in a scratch repo,
 * and stamp-upgrade.mjs uses them in the release.
 *
 * A section names a released change by version and changelog hash. A change that is not
 * released yet has neither, so its section says `Version: pending` and names the
 * changeset file instead. The release runs stamp-upgrade.mjs right after
 * `changeset version`, which swaps each pending pair for the real version and hash, so the
 * release commit lands with every section already released.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import getReleasePlan from '@changesets/get-release-plan';

import { parseChangelog, parseChangesetEntries } from '../src/resync/changelog.mjs';
import { parseVersion } from '../src/resync/semver.mjs';

export const UPGRADE_MD = join('packages', 'ai-patterns', 'src', 'migrate', 'upgrade.md');
export const PENDING = 'pending';

/* On 0.x, minor is the breaking lane, but most 0.x minors are additive. So a 0.x minor
   counts as breaking only when its author says so, by starting its text with this. The
   word "breaking" anywhere else does not count: a changeset that describes a check for
   breaking changes is not one. This is not ds-resync's rule (jumpClass in
   src/resync/): that one labels a whole version jump, so it calls every 0.x minor
   breaking. */
export const BREAKING_MARKER = '**Breaking:**';

/* A first word that looks like the marker but is not it (`Breaking:`, `**BREAKING:**`).
   It fails the suite, so a typo cannot quietly turn a breaking change into an additive one. */
const NEAR_MARKER = /^\W*breaking\b/i;

/* One changeset can ship in several packages and break only some of them, so coverage is
   per package. `changeset` is the changelog hash once released and the file name before. */
export const key = (pkg, changeset) => `${pkg} ${changeset}`;

const isZeroMinor = ({ bump, previous }) => bump === 'minor' && parseVersion(previous)?.major === 0;

/**
 * A change needs a section when it bumps a major, or bumps a 0.x minor and starts with
 * BREAKING_MARKER. `previous` is the version the package was on before the change.
 */
export function needsSection(change) {
  if (change.bump === 'major') return true;
  return isZeroMinor(change) && change.text.trimStart().startsWith(BREAKING_MARKER);
}

function packages(root) {
  const packagesDir = join(root, 'packages');
  return readdirSync(packagesDir)
    .map((dir) => join(packagesDir, dir))
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .map((dir) => ({ dir, ...JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }));
}

const SECTION_BUMP = {
  'Major Changes': 'major',
  'Minor Changes': 'minor',
  'Patch Changes': 'patch',
};

/** Every changeset in every package changelog, with the release it shipped in. */
export function releasedChangesets(root) {
  return packages(root)
    .filter(({ dir }) => existsSync(join(dir, 'CHANGELOG.md')))
    .flatMap(({ dir, name }) => {
      const releases = parseChangelog(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'));
      return releases.flatMap(({ version, body }, i) =>
        parseChangesetEntries(body).map((entry) => ({
          pkg: name,
          version,
          /* A package's first release has nothing before it. needsSection only reads this
             to tell 0.x from later, and the first release is on the same side of 1.0. */
          previous: releases[i + 1]?.version ?? version,
          bump: SECTION_BUMP[entry.section],
          changeset: entry.hash,
          text: entry.text,
        })),
      );
    });
}

/**
 * The pending changesets, read by Changesets itself, once per package each bumps, and the
 * version each package will be released at.
 */
export async function pendingChangesets(root) {
  const plan = await getReleasePlan(root);
  const releases = new Map(plan.releases.map((release) => [release.name, release]));
  const changes = plan.changesets.flatMap(({ id, summary, releases: bumps }) =>
    bumps
      .filter(({ type }) => type !== 'none')
      .map(({ name, type }) => ({
        pkg: name,
        version: PENDING,
        previous: releases.get(name).oldVersion,
        bump: type,
        changeset: id,
        text: summary,
      })),
  );
  const nextVersions = new Map(plan.releases.map(({ name, newVersion }) => [name, newVersion]));
  return { changes, nextVersions };
}

const fieldLine = (name) => new RegExp(`^- ${name}: \`([^\`]+)\`[ \\t]*\\r?$`, 'm');
const field = (section, name) => section.match(fieldLine(name))?.[1];
const setField = (section, name, value) =>
  section.replace(fieldLine(name), (line, old) => line.replace(`\`${old}\``, `\`${value}\``));
const sections = (markdown) => markdown.split(/(?=^## )/m);

/** @returns {{ heading: string, pkg?: string, version?: string, changeset?: string, migration?: string }[]} */
export function upgradeEntries(markdown) {
  return sections(markdown)
    .filter((section) => section.startsWith('## ') && /^- Package: /m.test(section))
    .map((section) => ({
      heading: section.slice(3).split('\n')[0].trim(),
      pkg: field(section, 'Package'),
      version: field(section, 'Version'),
      changeset: field(section, 'Changeset'),
      migration: field(section, 'Token migration'),
    }));
}

const describeChange = (change) =>
  `${key(change.pkg, change.changeset)} (${change.version}): ${change.text.split('\n')[0]}`;

/**
 * Holds upgrade.md to the changes, both ways.
 *
 * - missing: a breaking change, released or pending, with no section for its package.
 * - invented: a section naming a change that is not there. A released section must match
 *   a changelog entry in that package under that version. A pending one must match a
 *   pending changeset that bumps that package.
 * - nearMarker: a pending 0.x minor that starts like BREAKING_MARKER but is not it.
 */
export function coverage({ entries, released, pending }) {
  const changes = [...released, ...pending];
  const covered = new Set(entries.map((entry) => key(entry.pkg, entry.changeset)));
  const missing = changes
    .filter(needsSection)
    .filter((change) => !covered.has(key(change.pkg, change.changeset)))
    .map(describeChange);
  const invented = entries
    .filter(
      (entry) =>
        !changes.some(
          (change) =>
            change.pkg === entry.pkg &&
            change.version === entry.version &&
            change.changeset === entry.changeset,
        ),
    )
    .map(
      (entry) =>
        `${entry.heading}: ${entry.pkg}@${entry.version} has no changeset ${entry.changeset}`,
    );
  const nearMarker = pending
    .filter((change) => isZeroMinor(change) && !needsSection(change))
    .filter((change) => NEAR_MARKER.test(change.text))
    .map(describeChange);
  return { missing, invented, nearMarker };
}

/* Which token migrations need a section. A silent one (`report: "none"`) renders the same
   and `ds-resync migrate` says nothing about it, so it breaks nothing a consumer wrote and
   needs no section; one may still have a section. Every other migration needs exactly one.
   tokens' migrations.test.mjs is what holds a silent entry to a repoint that renders the
   same, so this exemption cannot let a visible change through. */
export function migrationCoverage(entries, migrations) {
  const named = entries.map((entry) => entry.migration).filter(Boolean);
  const ids = new Set(migrations.map((m) => m.id));
  return {
    missing: migrations
      .filter((m) => m.report !== 'none' && !named.includes(m.id))
      .map((m) => m.id),
    unknown: named.filter((id) => !ids.has(id)),
    duplicated: named.filter((id, i) => named.indexOf(id) !== i),
  };
}

/** Reads everything coverage() needs from a checkout. */
export async function readCoverageInputs(root) {
  const { changes, nextVersions } = await pendingChangesets(root);
  return {
    entries: upgradeEntries(readFileSync(join(root, UPGRADE_MD), 'utf8')),
    released: releasedChangesets(root),
    pending: changes,
    nextVersions,
  };
}

/**
 * Swaps each pending section's `Version: pending` and changeset name for the released
 * version and hash. `resolve(pkg, name)` returns `{ version, hash }`, or null while the
 * changeset is still pending, which leaves that section as it is.
 */
export function stampPending(markdown, resolve) {
  return sections(markdown)
    .map((section) => {
      const pkg = field(section, 'Package');
      const name = field(section, 'Changeset');
      if (field(section, 'Version') !== PENDING || !pkg || !name) return section;
      const released = resolve(pkg, name);
      if (!released) return section;
      return setField(setField(section, 'Version', released.version), 'Changeset', released.hash);
    })
    .join('');
}

/**
 * The resolver the release uses. Changesets writes each changelog entry's hash as the
 * first 7 characters of the commit that added the changeset file
 * (`git log --diff-filter=A`), so the hash is read from git the same way, and the version
 * is the release whose changelog holds that hash for that package. It throws when either
 * is missing, so a release cannot ship a section that is still pending.
 */
export function gitResolver(root) {
  const released = releasedChangesets(root);
  return (pkg, name) => {
    const file = join('.changeset', `${name}.md`);
    if (existsSync(join(root, file))) return null;
    const sha = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--max-count=1', '--format=%H', '--', file],
      { cwd: root, encoding: 'utf8' },
    ).trim();
    if (!sha) throw new Error(`upgrade.md: no commit added ${file}, so its hash is unknown.`);
    const hash = sha.slice(0, 7);
    const change = released.find((c) => c.pkg === pkg && c.changeset === hash);
    if (!change) {
      throw new Error(
        `upgrade.md: ${pkg}'s CHANGELOG.md has no entry ${hash} for changeset ${name}.`,
      );
    }
    return { version: change.version, hash };
  };
}
