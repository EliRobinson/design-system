#!/usr/bin/env node

// Writes dist/manifest.json and its declaration file. Run after tsc, as part of
// `pnpm run build`. Both are published as `@elirobinson/react/manifest`.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManifest } from './manifest.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptsDir, '..');
const distDir = join(packageRoot, 'dist');
const outFile = join(distDir, 'manifest.json');
const manifest = buildManifest(packageRoot);

mkdirSync(distDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(join(scriptsDir, 'manifest-types.d.ts'), join(distDir, 'manifest.d.ts'));

const gaps = manifest.components.filter((entry) => entry.extractionGaps.length > 0);

console.log(
  `manifest.json: ${manifest.components.length} components, ${manifest.hooks.length} hooks -> ${relative(packageRoot, outFile)}`,
);
if (gaps.length > 0) {
  console.log(`extraction gaps recorded for: ${gaps.map((entry) => entry.name).join(', ')}`);
}
