#!/usr/bin/env node
/* Accepts the current token roster as the baseline that migrations.json is
 * checked against.
 *
 * This is the deliberate half of a two-part contract, and it is deliberately
 * NOT part of `build`. `migrations.test.mjs` compares the stylesheets against
 * src/token-baseline.json and fails when a token has been removed or its
 * declared value repointed with no migration entry naming it. Running this
 * script says "those changes are accounted for" — so running it BEFORE
 * authoring the migration entries defeats the whole check.
 *
 * The order is: change the tokens, watch the test name what moved, write the
 * migration entries, then run this. The baseline diff lands in the same commit
 * as the entries, which is what makes it reviewable — the same contract the
 * visual-regression baselines in this repo run on.
 *
 * DECLARED values are snapshotted, not resolved ones. A repoint of
 * `--status-success` from `var(--anchor-500)` to a literal is a change of
 * wiring and a consumer needs to hear about it; a tweak to `--anchor-500`
 * underneath is a change of shade, which contrast.test.mjs already measures
 * and which would otherwise make every dependent token look migrated.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readTokenStylesheets, TOKENS_SRC_DIR } from '../src/token-stylesheets.mjs';
import { serializeTokenBaseline } from '../src/token-baseline.mjs';

const json = serializeTokenBaseline(readTokenStylesheets());

writeFileSync(join(TOKENS_SRC_DIR, 'token-baseline.json'), json);
process.stdout.write(
  `tokens: accepted src/token-baseline.json — migrations.json is now checked against this roster\n`,
);
