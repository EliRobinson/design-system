/* Shots the suite will take that have no baseline yet.
 *
 * These are not regressions and never were. Before this existed, adding a
 * component produced one "failure" per new shot — 68 of them on PR #88 — and
 * the only remedy was a manual Visual update dispatch. The PR job now mints
 * them in the same run.
 *
 * Only ever *missing* baselines: this cannot overwrite one that exists, which
 * is what keeps it from laundering a real regression into an accepted
 * baseline. Overwriting is the opt-in `visual-accept` path, deliberately
 * separate. */

import { existsSync, realpathSync } from 'node:fs';

import { listShots } from './visual-shots.mjs';

/** The shots among `shots` whose baseline does not exist. */
export function missingShots(shots, exists = existsSync) {
  return shots.filter((shot) => !exists(shot.baselinePath));
}

/**
 * A Playwright `--grep` pattern selecting exactly `shots`, or null for none.
 *
 * Null rather than an empty string, because `--grep ''` matches every test —
 * an empty selection must be impossible to turn into a full sweep by accident.
 *
 * Whole titles rather than prefixes: the caller already knows precisely which
 * shots it wants, so there is nothing to widen to. No `^` anchor — Playwright
 * matches --grep against the full title path, which starts with the spec file,
 * so a leading ^ matches nothing at all.
 */
export function grepFor(shots) {
  if (shots.length === 0) {
    return null;
  }

  const seen = new Set();
  for (const shot of shots) {
    seen.add(escapeRegExp(shot.title));
  }

  return [...seen].join('|');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* CLI: prints the pattern, or nothing at all when no baseline is missing, so a
   workflow step can test the output for emptiness.

   realpathSync rather than a bare string compare: process.argv[1] can reach
   this file through a symlink (or a relative `./name` / bare-name
   invocation), in which case it never string-equals import.meta.filename
   even though it is the same file on disk. Resolving both to their real path
   first is what makes the comparison correct in all of those cases. */
const isEntrypoint = process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename;

if (isEntrypoint) {
  const pattern = grepFor(missingShots(listShots()));
  if (pattern) {
    process.stdout.write(pattern);
  }
}
