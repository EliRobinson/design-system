#!/usr/bin/env node
/* Regenerates src/tokens.json from src/tokens.css.
 *
 * Runs as the first step of this package's `build`, before tsc — tokens-data.ts
 * imports the JSON and takes its type from it, so the file has to be correct on
 * disk before the compiler reads it. The result is committed because
 * `exports["./tokens.json"]` points straight at src/, and `tokens-json.test.mjs`
 * fails if the committed copy and the generator ever disagree.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeTokensJson } from '../src/tokens-json.mjs';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const json = serializeTokensJson(readFileSync(join(srcDir, 'tokens.css'), 'utf8'));

writeFileSync(join(srcDir, 'tokens.json'), json);
process.stdout.write(`tokens: wrote src/tokens.json (${json.length} bytes)\n`);
