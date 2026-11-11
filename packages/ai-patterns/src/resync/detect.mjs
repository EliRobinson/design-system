import { join } from 'node:path';
import { findPackageDir, readJson, versionOf } from '../package-lookup.mjs';
import { isWithin, lockedVersionFor, readLockfile } from './lockfile.mjs';

export const SCOPE = '@elirobinson/';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'];

/**
 * Scope-matched rather than a hardcoded package list, so packages published
 * later are picked up with no code change here.
 */
export function findScopedDependencies(packageJson) {
  const found = [];

  for (const field of DEPENDENCY_FIELDS) {
    const block = packageJson?.[field];
    if (!block || typeof block !== 'object') continue;

    for (const [name, declaredRange] of Object.entries(block)) {
      if (name.startsWith(SCOPE)) found.push({ name, declaredRange, field });
    }
  }

  return found.sort((a, b) => (a.name < b.name ? -1 : 1));
}

/**
 * Packages whose `node_modules` copy disagrees with the lockfile.
 *
 * Both versions have to be known for the comparison to mean anything. A
 * missing install is a fresh clone, not drift; a missing lockfile entry leaves
 * nothing to compare against.
 *
 * The install must also sit under the directory whose lockfile was read
 * (`installedUnderLock`). A project with its own lockfile and no `node_modules`
 * yet, inside a tree whose ancestor has an install, would otherwise be compared
 * against that ancestor's copy.
 *
 * Lives here rather than with either command because both need it: `ds-resync`
 * reports it, and `elirobinson-ds` warns that its own answers are about the
 * installed column.
 */
export function findDrift(entries) {
  return entries
    .filter(
      (entry) =>
        entry.installedVersion &&
        entry.lockedVersion &&
        entry.installedUnderLock &&
        entry.installedVersion !== entry.lockedVersion,
    )
    .map((entry) => ({
      name: entry.name,
      locked: entry.lockedVersion,
      installed: entry.installedVersion,
    }));
}

/**
 * Three readings of "the version of this dependency", kept apart on purpose:
 *
 * - `declaredRange` — what package.json asks for
 * - `lockedVersion` — what the lockfile resolved, i.e. what CI and a fresh
 *   clone install, and so what staleness is measured against
 * - `installedVersion` — what is in `node_modules` right now, which can have
 *   drifted ahead of both and is reported as its own finding when it has
 */
export function detect(cwd) {
  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = readJson(packageJsonPath);

  if (!packageJson) {
    throw new Error(`No package.json found at ${packageJsonPath}`);
  }

  const lock = readLockfile(cwd);

  return {
    packageJsonPath,
    packageJson,
    lock,
    packages: findScopedDependencies(packageJson).map((entry) => {
      // Walks `node_modules` up from `cwd`, like `ds-resync artifacts`, so a
      // workspace member with a hoisted install agrees with it.
      const installDir = findPackageDir(entry.name, [cwd]);
      return {
        ...entry,
        installedVersion: versionOf(installDir),
        installedUnderLock: Boolean(installDir && lock && isWithin(lock.dir, installDir)),
        lockedVersion: lockedVersionFor(lock, entry.name, entry.declaredRange),
      };
    }),
  };
}
