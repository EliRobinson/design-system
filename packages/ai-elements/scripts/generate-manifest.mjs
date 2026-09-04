#!/usr/bin/env node

// Writes dist/manifest.json and its declaration file. Run after tsc, as part of
// `pnpm run build`. Published as `@elirobinson/ai-elements/manifest`.
//
// It exists so that nothing outside this package has to keep a list of what the
// package contains. There is no barrel and there is no component table in any
// README: a consumer, an agent, or the `ds` CLI reads the manifest, which is
// regenerated from the emitted declarations on every build and therefore cannot
// describe a component the package no longer ships.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptsDir, '..');
const distDir = join(packageRoot, 'dist');
const outFile = join(distDir, 'manifest.json');

const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(packageRoot, 'elements.lock.json'), 'utf8'));

/**
 * Named exports, read from the declaration file rather than the source: tsc has
 * already resolved re-exports and dropped anything not actually exported, so
 * this cannot claim an export the built package does not have.
 */
function namedExports(declarationPath) {
  const source = readFileSync(declarationPath, 'utf8');
  const names = new Set();

  for (const [, name] of source.matchAll(
    /^export\s+declare\s+(?:const|function|class|abstract\s+class|enum)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    names.add(name);
  }

  for (const [, name] of source.matchAll(/^export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(name);
  }

  for (const [, clause] of source.matchAll(/^export\s*\{([^}]*)\}/gms)) {
    for (const specifier of clause.split(',')) {
      const name = specifier
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop();
      if (name) {
        names.add(name);
      }
    }
  }

  return [...names].sort();
}

const entries = [];

for (const tier of ['components', 'ui', 'lib']) {
  const tierDir = join(distDir, tier);

  if (!existsSync(tierDir)) {
    continue;
  }

  for (const file of readdirSync(tierDir).sort()) {
    if (!file.endsWith('.d.ts')) {
      continue;
    }

    const name = file.replace(/\.d\.ts$/, '');
    const target = `src/${tier}/${name}.tsx`;
    const record = lock.files[target] ?? lock.files[`src/${tier}/${name}.ts`];

    if (!record) {
      throw new Error(
        `dist/${tier}/${file} has no entry in elements.lock.json. ` +
          'The build emitted something that was not vendored — run `pnpm sync:elements`.',
      );
    }

    entries.push({
      name,
      tier,
      subpath: `${pkg.name}/${tier}/${name}`,
      exports: namedExports(join(tierDir, file)),
      upstreamPath: record.from,
    });
  }
}

const manifest = {
  package: pkg.name,
  version: pkg.version,
  upstream: {
    repo: lock.upstream.repo,
    ref: lock.upstream.ref,
    commit: lock.upstream.commit,
    license: lock.upstream.license,
  },
  entries,
};

mkdirSync(distDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(join(scriptsDir, 'manifest-types.d.ts'), join(distDir, 'manifest.d.ts'));

const byTier = entries.reduce((counts, entry) => {
  counts[entry.tier] = (counts[entry.tier] ?? 0) + 1;
  return counts;
}, {});

console.log(
  `manifest.json: ${Object.entries(byTier)
    .map(([tier, count]) => `${count} ${tier}`)
    .join(', ')} at ${lock.upstream.ref} -> ${relative(packageRoot, outFile)}`,
);
