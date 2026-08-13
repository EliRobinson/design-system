import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lockedVersionFor, readLockfile } from './lockfile.mjs';

export const SCOPE = '@elirobinson/';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

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

export function readInstalledVersion(cwd, name) {
  const manifest = readJson(join(cwd, 'node_modules', ...name.split('/'), 'package.json'));
  return manifest?.version ?? null;
}

/**
 * Packages whose `node_modules` copy disagrees with the lockfile.
 *
 * Both versions have to be known for the comparison to mean anything. A
 * missing install is a fresh clone, not drift; a missing lockfile entry leaves
 * nothing to compare against, and that case is indistinguishable from a
 * workspace whose `node_modules` is hoisted somewhere above this directory —
 * warning there would be a false positive, so it stays silent instead.
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
