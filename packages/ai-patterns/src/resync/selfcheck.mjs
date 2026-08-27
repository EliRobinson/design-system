/*
 * `pnpm dlx`/`npx` can hit a registry auth error while resolving what to run
 * and silently fall back to whatever build is sitting in the dlx cache
 * instead of failing (#211). By the time this process is running, local
 * state has no way to say whether that happened — the code already believes
 * it is `readOwnVersion().version`, cached copy or not. The only way to find
 * out is to ask the registry what it currently considers latest and compare.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This package's own name and version, read from its own package.json. */
export function readOwnVersion() {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
  const { name, version } = JSON.parse(readFileSync(path, 'utf-8'));
  return { name, version };
}

/**
 * Pure comparison, mirrors `checkDrift` in artifacts.mjs: null means nothing
 * to report, an object means this running copy is not what the registry
 * considers current.
 */
export function checkSelfDrift({ running, latest }) {
  if (!latest || latest === running) return null;
  return { running, latest };
}

export function formatSelfStaleWarning(drift, name) {
  return [
    '!!  STALE BINARY',
    `!!  This is ${name}@${drift.running}, but the registry's latest is ${drift.latest}.`,
    '!!  If this ran through `pnpm dlx` or `npx`, the fetch of the current release likely',
    '!!  failed silently — a registry auth error is the common cause — and this is an old',
    '!!  copy running anyway. Everything below may describe a version behind what it claims.',
    '!!',
    '!!  Install it instead of running it through dlx, so a fetch failure is loud:',
    `!!    pnpm add -D ${name}`,
    '!!    ./node_modules/.bin/ds-resync ...',
  ].join('\n');
}
