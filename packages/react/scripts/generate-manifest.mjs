#!/usr/bin/env node

// Writes dist/manifest.json. Run after tsc, as part of `pnpm run build`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManifest } from './manifest.mjs';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(packageRoot, 'dist', 'manifest.json');
const manifest = buildManifest(packageRoot);

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `manifest.json: ${manifest.components.length} components, ${manifest.hooks.length} hooks -> ${relative(packageRoot, outFile)}`,
);
