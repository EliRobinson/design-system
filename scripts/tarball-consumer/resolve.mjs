/* Reading the scratch app's node_modules: files, manifests, and the bare CSS
 * @import a bundler would resolve. */

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { resolveExport } from './exports.mjs';

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Every file under `root`, as `./`-prefixed paths, skipping nested node_modules. */
export function listFiles(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `./${join(entry.parentPath, entry.name).slice(root.length + 1)}`)
    .filter((path) => !path.split('/').includes('node_modules'));
}

/** `@scope/name/sub/path` → `@scope/name`; `name/sub` → `name`. */
export function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** The installed directory `name` resolves to from `fromDir`, pnpm's layout included. */
function findPackageDir(name, fromDir) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dirname(dir) === dir) return null;
  }
}

/* The condition a CSS bundler adds when it resolves a bare @import. It is what
   points `@import 'tailwindcss'` at tailwindcss's stylesheet rather than its
   JavaScript — which is why Node's own resolver cannot be used here. */
const CSS_CONDITIONS = ['style'];

/**
 * Resolves a CSS @import the way a bundler does.
 *
 * @param {string} specifier as written after @import
 * @param {string | null} fromFile the importing stylesheet, null for the app's entry
 * @param {string} consumer the scratch app, where an entry resolves from
 * @returns {string | null} the file, or null when nothing a bundler would find is there
 */
export function resolveCss(specifier, fromFile, consumer) {
  if (specifier.startsWith('.')) {
    const file = join(dirname(fromFile), specifier);
    return existsSync(file) ? file : null;
  }
  const name = packageName(specifier);
  const dir = findPackageDir(name, fromFile ? dirname(fromFile) : consumer);
  if (!dir) return null;
  const manifest = readJson(join(dir, 'package.json'));
  const subpath = `.${specifier.slice(name.length)}`;
  const target = manifest.exports
    ? resolveExport(manifest.exports, subpath, CSS_CONDITIONS)
    : subpath === '.'
      ? (manifest.style ?? manifest.main)
      : subpath;
  if (!target) return null;
  const file = join(dir, target);
  return existsSync(file) ? file : null;
}
