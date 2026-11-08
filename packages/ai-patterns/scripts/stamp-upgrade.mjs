#!/usr/bin/env node
/* Runs in the release, right after `changeset version` (the root `changeset:version`
 * script). Every upgrade.md section whose changeset was just released gets its real
 * version and hash in place of `Version: pending` and the changeset name, so the release
 * commit keeps upgrade-coverage.test.mjs green (#334).
 *
 * Usage: node packages/ai-patterns/scripts/stamp-upgrade.mjs [repo root]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { gitResolver, stampPending, UPGRADE_MD } from './upgrade-coverage.mjs';

const root = resolve(
  process.argv[2] ?? join(fileURLToPath(import.meta.url), '..', '..', '..', '..'),
);
const path = join(root, UPGRADE_MD);
const before = readFileSync(path, 'utf8');
const after = stampPending(before, gitResolver(root));
if (after !== before) {
  writeFileSync(path, after);
  console.log(`Stamped released versions and hashes into ${UPGRADE_MD}.`);
}
