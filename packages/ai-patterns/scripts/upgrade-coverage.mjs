/* What upgrade-coverage.test.mjs and stamp-upgrade.mjs share (#322, #334): reading
 * upgrade.md, the released changelogs and the pending changesets, and deciding which
 * changes need a section.
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

import { parseChangelog, parseChangesetEntries } from '../src/resync/changelog.mjs';
import { parseVersion } from '../src/resync/semver.mjs';

export const UPGRADE_MD = join('packages', 'ai-patterns', 'src', 'migrate', 'upgrade.md');
export const PENDING = 'pending';

/* On 0.x, minor is the breaking lane, but most 0.x minors are additive. So a 0.x minor
   counts as breaking only when its author says so, by starting its text with this. The
   word "breaking" anywhere else does not count: a changeset that describes a check for
   breaking changes is not one. */
export const BREAKING_MARKER = '**Breaking:**';

/* One changeset can ship in several packages and break only some of them, so coverage is
   per package. `id` is the changelog hash once released and the changeset name before. */
export const key = (pkg, id) => `${pkg} ${id}`;

/**
 * A change needs a section when it bumps a major, or bumps a 0.x minor and starts with
 * BREAKING_MARKER. `previous` is the version the package was on before the change.
 */
export function needsSection({ bump, previous, text }) {
  if (bump === 'major') return true;
  return (
    bump === 'minor' &&
    parseVersion(previous)?.major === 0 &&
    text.trimStart().startsWith(BREAKING_MARKER)
  );
}

function packageDirs(root) {
  const packagesDir = join(root, 'packages');
  return readdirSync(packagesDir)
    .map((dir) => join(packagesDir, dir))
    .filter((dir) => existsSync(join(dir, 'package.json')));
}

/** Every package's name and current version. */
export function packageVersions(root) {
  return new Map(
    packageDirs(root).map((dir) => {
      const { name, version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      return [name, version];
    }),
  );
}

const SECTION_BUMP = {
  'Major Changes': 'major',
  'Minor Changes': 'minor',
  'Patch Changes': 'patch',
};

/**
 * Every changeset in every package changelog. `version` is the release it shipped in and
 * `previous` the one before it in that changelog, which is what needsSection reads.
 */
export function releasedChangesets(root) {
  return packageDirs(root)
    .filter((dir) => existsSync(join(dir, 'CHANGELOG.md')))
    .flatMap((dir) => {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name;
      const releases = parseChangelog(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'));
      return releases.flatMap(({ version, body }, i) =>
        parseChangesetEntries(body).map((entry) => ({
          pkg,
          version,
          previous: releases[i + 1]?.version ?? version,
          bump: SECTION_BUMP[entry.section],
          id: entry.hash,
          text: entry.text,
        })),
      );
    });
}

/**
 * Parses one `.changeset/*.md` file: the `'<package>': <bump>` lines of its front matter
 * and the text after it.
 */
export function parseChangesetFile(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!match) return { releases: [], text: '' };
  const releases = [
    ...match[1].matchAll(/^\s*["']?([^"':\s]+)["']?\s*:\s*(major|minor|patch)\s*$/gm),
  ].map(([, pkg, bump]) => ({ pkg, bump }));
  return { releases, text: match[2].trim() };
}

/** Every pending changeset, once per package it bumps. `id` is the file name without `.md`. */
export function pendingChangesets(root) {
  const dir = join(root, '.changeset');
  if (!existsSync(dir)) return [];
  const versions = packageVersions(root);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .flatMap((file) => {
      const { releases, text } = parseChangesetFile(readFileSync(join(dir, file), 'utf8'));
      return releases.map(({ pkg, bump }) => ({
        pkg,
        version: PENDING,
        previous: versions.get(pkg),
        bump,
        id: file.slice(0, -'.md'.length),
        text,
      }));
    });
}

const field = (section, name) => section.match(new RegExp(`^- ${name}: \`([^\`]+)\``, 'm'))?.[1];

/** @returns {{ id: string, pkg?: string, version?: string, changeset?: string, migration?: string }[]} */
export function upgradeEntries(markdown) {
  return markdown
    .split(/^## /m)
    .slice(1)
    .filter((section) => /^- Package: /m.test(section))
    .map((section) => ({
      id: section.split('\n')[0].trim(),
      pkg: field(section, 'Package'),
      version: field(section, 'Version'),
      changeset: field(section, 'Changeset'),
      migration: field(section, 'Token migration'),
    }));
}

/**
 * Holds upgrade.md to the changes, both ways.
 *
 * - missing: a breaking change, released or pending, with no section for its package.
 * - invented: a section naming a change that is not there. A released section must match
 *   a changelog entry in that package under that version. A pending one must match a
 *   pending changeset that bumps that package.
 */
export function coverage({ entries, released, pending }) {
  const changes = [...released, ...pending];
  const covered = new Set(entries.map((entry) => key(entry.pkg, entry.changeset)));
  const missing = changes
    .filter(needsSection)
    .filter((change) => !covered.has(key(change.pkg, change.id)))
    .map(
      (change) =>
        `${key(change.pkg, change.id)} (${change.version}): ${change.text.split('\n')[0]}`,
    );
  const invented = entries
    .filter(
      (entry) =>
        !changes.some(
          (change) =>
            change.pkg === entry.pkg &&
            change.version === entry.version &&
            change.id === entry.changeset,
        ),
    )
    .map(
      (entry) => `${entry.id}: ${entry.pkg}@${entry.version} has no changeset ${entry.changeset}`,
    );
  return { missing, invented };
}

/** Reads everything coverage() needs from a checkout. */
export function readCoverageInputs(root) {
  return {
    entries: upgradeEntries(readFileSync(join(root, UPGRADE_MD), 'utf8')),
    released: releasedChangesets(root),
    pending: pendingChangesets(root),
  };
}

/**
 * Swaps each pending section's `Version: pending` and changeset name for the released
 * version and hash. `resolve(pkg, name)` returns `{ version, hash }`, or null while the
 * changeset is still pending, which leaves that section as it is.
 */
export function stampPending(markdown, resolve) {
  return markdown
    .split(/(?=^## )/m)
    .map((section) => {
      const pkg = field(section, 'Package');
      const name = field(section, 'Changeset');
      if (field(section, 'Version') !== PENDING || !pkg || !name) return section;
      const released = resolve(pkg, name);
      if (!released) return section;
      return section
        .replace(/^- Version: `pending`$/m, `- Version: \`${released.version}\``)
        .replace(
          new RegExp(`^- Changeset: \`${name}\`$`, 'm'),
          `- Changeset: \`${released.hash}\``,
        );
    })
    .join('');
}

/**
 * The resolver the release uses. Changesets writes each changelog entry's hash as the
 * first 7 characters of the commit that added the changeset file, so the hash is read
 * from git the same way, and the version is the release whose changelog holds that hash
 * for that package. It throws when either is missing, so a release cannot ship a section
 * that is still pending.
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
    const change = released.find((c) => c.pkg === pkg && c.id === hash);
    if (!change) {
      throw new Error(
        `upgrade.md: ${pkg}'s CHANGELOG.md has no entry ${hash} for changeset ${name}.`,
      );
    }
    return { version: change.version, hash };
  };
}
