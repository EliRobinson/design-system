// The one place that finds an installed package and reads from it. Both `ds`
// (cli/) and `ds-resync` (resync/) need it, and neither may depend on the
// other, so it lives beside them.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REACT_PKG = '@elirobinson/react';
export const TOKENS_PKG = '@elirobinson/tokens';
export const PATTERNS_PKG = '@elirobinson/ai-patterns';

/**
 * Walk up from each origin looking for node_modules/<name>.
 *
 * cwd comes first: the CLI runs from a consumer's project root, and that is the
 * install the consumer means. The module's own location is the fallback, which
 * is what finds the package under pnpm's nested store layout.
 */
export function findPackageDir(name, origins = defaultOrigins()) {
  const segments = name.split('/');

  for (const origin of origins) {
    let dir = origin;
    for (;;) {
      const candidate = join(dir, 'node_modules', ...segments);
      if (existsSync(join(candidate, 'package.json'))) return candidate;
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  }

  return null;
}

function defaultOrigins() {
  return [process.cwd(), dirname(fileURLToPath(import.meta.url))];
}

export function readFile(path) {
  return path && existsSync(path) ? readFileSync(path, 'utf8') : null;
}

export function readJson(path) {
  const raw = readFile(path);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function versionOf(packageDir) {
  return readJson(packageDir && join(packageDir, 'package.json'))?.version ?? null;
}

/**
 * `{ root, version }` for the package installed at or above `cwd`, or null.
 * Throws when its package.json has no readable version.
 */
export function readInstalled(cwd, name) {
  const root = findPackageDir(name, [cwd]);
  if (!root) return null;
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!version) throw new Error(`${name} has no version in ${join(root, 'package.json')}`);
  return { root, version };
}
