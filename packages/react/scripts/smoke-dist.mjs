#!/usr/bin/env node

/* Loads every built module with Node's own ESM resolver. Run after tsc, as the
 * last step of `pnpm run build`.
 *
 * Bundlers resolve an extensionless `./utils` to `./utils.js`; Node does not.
 * tsc emits relative specifiers exactly as written in source, so a single
 * extensionless import compiles clean, bundles clean, and then throws
 * ERR_MODULE_NOT_FOUND in any runtime that feeds dist/ to Node directly — a
 * Vite SSR dev server being the case that shipped (consumers had to work
 * around it with `ssr.noExternal`). Importing dist with plain `node` is the
 * only check that uses the resolver consumers' servers use.
 */

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const modules = readdirSync(distDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();

if (modules.length === 0) {
  console.error('smoke-dist: no .js modules under dist/ — run tsc first.');
  process.exit(1);
}

const failures = [];
for (const module of modules) {
  try {
    await import(pathToFileURL(module));
  } catch (error) {
    failures.push({ module: module.slice(distDir.length + 1), message: error.message });
  }
}

/* The subpath consumers actually write, resolved through the exports map via
   Node's self-reference support — file-URL imports above bypass it. */
const subpath = '@elirobinson/react/components/atoms/Button';
try {
  await import(subpath);
} catch (error) {
  failures.push({ module: subpath, message: error.message });
}

if (failures.length > 0) {
  console.error(`smoke-dist: ${failures.length} module(s) failed to load under plain node:`);
  for (const failure of failures) {
    console.error(`  ${failure.module}\n    ${failure.message.split('\n')[0]}`);
  }
  process.exit(1);
}

console.log(`smoke-dist: ${modules.length} modules + ${subpath} load under plain node`);
