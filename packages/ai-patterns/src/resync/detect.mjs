import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

export function detect(cwd) {
  const packageJsonPath = join(cwd, 'package.json');
  const packageJson = readJson(packageJsonPath);

  if (!packageJson) {
    throw new Error(`No package.json found at ${packageJsonPath}`);
  }

  return {
    packageJsonPath,
    packageJson,
    packages: findScopedDependencies(packageJson).map((entry) => ({
      ...entry,
      installedVersion: readInstalledVersion(cwd, entry.name),
    })),
  };
}
