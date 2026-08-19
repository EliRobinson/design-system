#!/usr/bin/env node
/* Regenerates src/tokens.json from every token stylesheet in src/.
 *
 * Which files those are is `TOKEN_STYLESHEETS`, not a path spelled out here:
 * tokens.css @imports palettes.css, so half the vocabulary — the brand ramps,
 * the semantics derived from them, status and chart — is in the sibling file,
 * and a generator that read tokens.css alone would write a tokens.json with no
 * brand in it and no complaint about it.
 *
 * Runs as the first step of this package's `build`, before tsc — tokens-data.ts
 * imports the JSON and takes its type from it, so the file has to be correct on
 * disk before the compiler reads it. The result is committed because
 * `exports["./tokens.json"]` points straight at src/, and `tokens-json.test.mjs`
 * fails if the committed copy and the generator ever disagree.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readTokenStylesheets, TOKENS_SRC_DIR } from '../src/token-stylesheets.mjs';
import { serializeTokensJson } from '../src/tokens-json.mjs';

const json = serializeTokensJson(readTokenStylesheets());

writeFileSync(join(TOKENS_SRC_DIR, 'tokens.json'), json);
process.stdout.write(`tokens: wrote src/tokens.json (${json.length} bytes)\n`);
