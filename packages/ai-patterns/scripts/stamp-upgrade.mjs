#!/usr/bin/env node
/* Runs in the release, right after `changeset version` (the root `changeset:version`
 * script). Every upgrade.md section whose changeset was just released gets its real
 * version and hash in place of `Version: pending` and the changeset name, so the release
 * commit keeps upgrade-coverage.test.mjs green (#334). The release runs no tests before
 * it pushes, so this then checks coverage itself and fails the release if anything is
 * still missing or invented.
 *
 * Usage: node packages/ai-patterns/scripts/stamp-upgrade.mjs [repo root]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  coverage,
  gitResolver,
  readCoverageInputs,
  stampPending,
  UPGRADE_MD,
} from './upgrade-coverage.mjs';

const root = resolve(
  process.argv[2] ?? join(fileURLToPath(import.meta.url), '..', '..', '..', '..'),
);
const path = join(root, UPGRADE_MD);
const before = readFileSync(path, 'utf8');
const after = stampPending(before, gitResolver(root));
if (after !== before) {
  writeFileSync(path, after);
  process.stdout.write(`Stamped released versions and hashes into ${UPGRADE_MD}.\n`);
}

const { missing, invented } = coverage(await readCoverageInputs(root));
if (missing.length > 0 || invented.length > 0) {
  process.stderr.write(
    [`${UPGRADE_MD} does not match the release:`, ...missing, ...invented].join('\n') + '\n',
  );
  process.exit(1);
}
