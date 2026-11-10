import { join } from 'node:path';
import { findPackageDir, readJson, versionOf } from '../cli/discovery.mjs';
import { lockedVersionFor, readLockfile } from './lockfile.mjs';

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
 * Walks `node_modules` up from `cwd`, the way `ds-resync artifacts` does, so a
 * workspace member with a hoisted install agrees with it.
 */
export function readInstalledVersion(cwd, name) {
  return versionOf(findPackageDir(name, [cwd]));
}

/**
 * Packages whose `node_modules` copy disagrees with the lockfile.
 *
 * Both versions have to be known for the comparison to mean anything. A
 * missing install is a fresh clone, not drift; a missing lockfile entry leaves
 * nothing to compare against. That is the case for a workspace member whose
 * lockfile lives at the root: the lockfile is read from `cwd` only, while the
 * install is found by walking up. Warning there would be a false positive, so
 * it stays silent instead.
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
    packages: findScopedDependencies(packageJson).map((entry) => ({
      ...entry,
      installedVersion: readInstalledVersion(cwd, entry.name),
      lockedVersion: lockedVersionFor(lock, entry.name, entry.declaredRange),
    })),
  };
}
