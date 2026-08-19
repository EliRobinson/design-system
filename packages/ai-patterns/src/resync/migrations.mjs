/* Where migrations come from, and which of them a given upgrade crosses.
 *
 * The manifests are NOT shipped in this package. Each one is authored beside
 * the thing it describes — `@elirobinson/tokens` owns the token migrations,
 * checked against its own stylesheets by its own test — and is read out of the
 * consumer's node_modules at run time. That is the same property the rest of
 * this CLI has: a copy here would be a second inventory to keep in step, and
 * the version of the manifest that matters is the version the consumer just
 * installed, not the version of `ds-resync` they happened to invoke.
 *
 * A manifest lists every migration the package has ever published, each stamped
 * with the version it landed in. Selecting the ones an upgrade crosses is
 * therefore a version-range filter and nothing more, which is what lets one
 * command serve a consumer jumping one minor and a consumer jumping four.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SCOPE } from './detect.mjs';
import { compareVersions, parseVersion } from './semver.mjs';

/** Where a package keeps its manifest, relative to its own root. */
export const MANIFEST_PATH = 'src/migrations.json';

/** The record `ds-resync --write` leaves behind, relative to the repo root. */
export const UPGRADE_RECORD_PATH = '.claude/ds-resync.json';

/**
 * Reads one package's manifest out of the consuming repo's node_modules.
 * Returns null when the package ships none — most do, and that is not an error.
 */
export function readManifest(cwd, name) {
  const path = join(cwd, 'node_modules', ...name.split('/'), MANIFEST_PATH);
  if (!existsSync(path)) return null;

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed?.migrations)) return null;
    return { ...parsed, package: parsed.package ?? name };
  } catch (error) {
    // A manifest that exists but will not parse is a broken install, not a
    // package without migrations. Saying so beats reporting "nothing to do".
    throw new Error(
      `${name} ships a migration manifest at ${MANIFEST_PATH} that is not valid JSON ` +
        `(${error.message}). Re-install the package; if it persists, the published ` +
        'tarball is corrupt and the version should be reported.',
    );
  }
}

/**
 * The migrations an upgrade from `from` to `to` crosses: everything published
 * after the version the consumer was on, up to and including the one they moved
 * to. The same half-open interval `sliceChangelog` uses, so a migration and the
 * changelog entry that describes it are never selected apart.
 *
 * `from` of null means "everything", which is what a run with no upgrade record
 * falls back to. Over-reporting is the safe direction: a rename that has
 * already been applied finds nothing left to rename, and everything else is
 * report-only.
 */
export function selectMigrations(manifest, from, to) {
  // Both ends are re-checked rather than trusted. `resolveRange` already drops
  // an unusable one, but this function is exported and a caller that skipped it
  // should get a wider range, not a crash inside `compareVersions`.
  const low = parseVersion(from ?? '') ? from : null;
  const high = parseVersion(to ?? '') ? to : null;

  return manifest.migrations.filter((entry) => {
    if (!parseVersion(entry.since)) return false;
    if (low !== null && compareVersions(entry.since, low) <= 0) return false;
    if (high !== null && compareVersions(entry.since, high) > 0) return false;
    return true;
  });
}

/** Every token any of these migrations looks for. */
export function tokensOf(migrations) {
  return new Set(migrations.flatMap((entry) => entry.from));
}

/**
 * What `ds-resync --write` recorded about the last upgrade, so `migrate`
 * knows which range to cross without the user having to remember it.
 *
 * Absent is normal — a consumer can run `migrate` without ever having run the
 * upgrade through this tool — so a missing or unreadable record is an empty
 * one, never a throw.
 */
export function readUpgradeRecord(cwd) {
  try {
    const parsed = JSON.parse(readFileSync(join(cwd, UPGRADE_RECORD_PATH), 'utf8'));
    return parsed?.upgrades ?? {};
  } catch {
    return {};
  }
}

/**
 * The version range to migrate one package across.
 *
 * `to` is what is installed right now: `migrate` runs after the install, so
 * node_modules is the authority on where the repo landed. `from` is the version
 * the upgrade started at, which only the record knows — nothing on disk
 * remembers it once the install has happened. With no record, `from` is null
 * and every migration is considered; the caller says so in the report rather
 * than pretending the range was narrow.
 */
export function resolveRange({ record, installedVersion, explicitFrom, explicitTo }) {
  /* Everything reaching this function has to survive being nonsense. The flags
     are validated at parse time, but the record is a file on the consumer's
     disk that anybody may have hand-edited — and `readUpgradeRecord` promises
     never to throw on it. Honouring that promise syntactically and then handing
     `"^0.8.0"` to `compareVersions` would break it semantically, one frame
     further down, with an error naming neither the file nor the field. An
     unusable end is simply not known, and an unknown end is a case the command
     already handles and already narrates. */
  const usable = (value) => (parseVersion(value ?? '') ? value : null);

  return {
    from: usable(explicitFrom) ?? usable(record?.from) ?? null,
    to: usable(explicitTo) ?? usable(installedVersion) ?? usable(record?.to) ?? null,
  };
}

/**
 * Every `@elirobinson/*` package in this repo that ships migrations, with the
 * range each is being migrated across and the entries that fall in it.
 *
 * @param {object} input
 * @param {string} input.cwd
 * @param {Array<{name: string, installedVersion: string|null}>} input.packages
 * @param {Record<string, {from?: string, to?: string}>} input.record
 * @param {string|null} [input.explicitFrom]
 * @param {string|null} [input.explicitTo]
 * @param {string[]|null} [input.only] restrict to these package names
 */
export function collectMigrations({
  cwd,
  packages,
  record,
  explicitFrom = null,
  explicitTo = null,
  only = null,
}) {
  const collected = [];

  for (const entry of packages) {
    if (!entry.name.startsWith(SCOPE)) continue;
    if (only && !only.includes(entry.name)) continue;

    const manifest = readManifest(cwd, entry.name);
    if (!manifest) continue;

    const { from, to } = resolveRange({
      record: record[entry.name],
      installedVersion: entry.installedVersion,
      explicitFrom,
      explicitTo,
    });

    collected.push({
      name: entry.name,
      from,
      to,
      installedVersion: entry.installedVersion,
      migrations: selectMigrations(manifest, from, to),
    });
  }

  return collected;
}
