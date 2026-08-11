/* `ds-resync artifacts` — writes the shipped agent artifacts into a consuming
 * repo and keeps them refreshable without ever destroying a local edit.
 *
 * Two guarantees, and the whole module exists to hold them:
 *
 * 1. **Never clobber an edit.** Every file this command writes is recorded with
 *    the sha256 of exactly what was written, in `.claude/ds-artifacts.json`. On
 *    the next run a file whose hash still matches its record is ours to update;
 *    a file whose hash has moved was edited locally, so it is left alone and
 *    named in the report. An untracked file that happens to exist is treated as
 *    edited, because the conservative reading is the only safe one.
 *
 * 2. **Never let a stale snapshot pass for current.** The artifacts carry the
 *    `@elirobinson/react` version they were generated against. If the repo has
 *    a different one installed, the prop tables in the snapshot describe code
 *    that is not here, and an agent reading them is confidently wrong. That is
 *    reported loudly, on every run, whether or not anything is written.
 *
 * The planning half is pure so both guarantees are testable without a
 * filesystem; `readArtifactSet`/`applyPlan` are the only parts that touch disk.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readInstalledVersion } from './detect.mjs';

/** Where the record of what we wrote lives, relative to the consuming repo root. */
export const RECORD_PATH = '.claude/ds-artifacts.json';

export const REACT_PACKAGE = '@elirobinson/react';

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Resolves the staged tree inside this package, installed or in the workspace. */
export function artifactsDir() {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'artifacts');
}

/**
 * Reads the staged tree: the stamp plus the bytes of every file in it.
 * Throws with an actionable message when the package was built without it.
 */
export function readArtifactSet(dir = artifactsDir()) {
  const stampPath = join(dir, 'artifacts.json');

  if (!existsSync(stampPath)) {
    throw new Error(
      `No artifacts found at ${dir}. This copy of @elirobinson/ai-patterns was packed ` +
        'without them — upgrade to a version that ships them, or run `pnpm build` in the ' +
        'design-system repo if you are working from a checkout.',
    );
  }

  const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));

  return {
    stamp,
    targetRoot: stamp.targetRoot ?? '.claude/skills',
    files: stamp.files.map((entry) => ({
      path: entry.path,
      hash: entry.hash,
      contents: readFileSync(join(dir, 'skills', entry.path)),
    })),
  };
}

/** The record of a previous run, or an empty one. Corruption is not fatal —
 *  a broken record just means every file looks untracked, which is safe. */
export function readRecord(cwd) {
  try {
    const parsed = JSON.parse(readFileSync(join(cwd, RECORD_PATH), 'utf8'));
    return { ...parsed, files: parsed.files ?? {} };
  } catch {
    return { files: {} };
  }
}

/**
 * Decides what happens to each shipped file. Pure: `onDisk` maps a destination
 * path to the sha256 of what is currently there, or null when nothing is.
 *
 * @param {object} input
 * @param {Array<{path: string, hash: string}>} input.files staged files
 * @param {string} input.targetRoot destination prefix inside the repo
 * @param {Record<string, string>} input.recorded path → hash we last wrote
 * @param {Record<string, string|null>} input.onDisk destination path → current hash
 * @param {boolean} [input.force] overwrite locally-edited files
 */
export function planWrite({ files, targetRoot, recorded, onDisk, force = false }) {
  return files.map((file) => {
    const target = `${targetRoot}/${file.path}`;
    const current = onDisk[target] ?? null;
    const previous = recorded[target] ?? null;

    if (current === null) return { path: file.path, target, hash: file.hash, status: 'created' };

    // Already exactly what we would write. Nothing to do, and no need to care
    // whether we are the one who put it there.
    if (current === file.hash) {
      return { path: file.path, target, hash: file.hash, status: 'unchanged' };
    }

    const ours = previous !== null && current === previous;
    if (ours || force) {
      return {
        path: file.path,
        target,
        hash: file.hash,
        status: force && !ours ? 'overwritten' : 'updated',
      };
    }

    return {
      path: file.path,
      target,
      hash: file.hash,
      status: 'modified',
      reason: previous === null ? 'not written by this command' : 'edited since it was written',
    };
  });
}

const WRITTEN_STATUSES = new Set(['created', 'updated', 'overwritten']);

/** Statuses whose file content on disk matches `hash` after a write. */
export function recordFrom(plan, previous) {
  const files = { ...previous };
  for (const entry of plan) {
    if (WRITTEN_STATUSES.has(entry.status) || entry.status === 'unchanged') {
      files[entry.target] = entry.hash;
    }
  }
  return files;
}

/**
 * Compares the version the snapshot was generated against with what the repo
 * actually has installed. `installed` is null when the package is absent, which
 * is not drift — there is nothing for the snapshot to be wrong about yet.
 */
export function checkDrift({ stamp, installed }) {
  if (!installed || !stamp.reactVersion) return null;
  if (installed === stamp.reactVersion) return null;
  return { expected: stamp.reactVersion, installed };
}

export function formatDriftWarning(drift) {
  return [
    '!!  STALE SNAPSHOT',
    `!!  These artifacts describe ${REACT_PACKAGE}@${drift.expected}, but this repo has`,
    `!!  ${drift.installed} installed. Component and prop tables in llms-full.txt may name`,
    '!!  props that do not exist at the installed version, and omit ones that do.',
    '!!',
    '!!  Fix it by bringing the two into line:',
    '!!    pnpm dlx @elirobinson/ai-patterns ds-resync            # move the packages',
    '!!    pnpm dlx @elirobinson/ai-patterns ds-resync artifacts --write   # or refresh these',
    '!!  Until then, trust `pnpm ds props <Name>` over anything in the snapshot.',
  ].join('\n');
}

export function formatArtifactsReport(result) {
  const lines = [];

  if (result.drift) lines.push(formatDriftWarning(result.drift), '');

  const byStatus = (status) => result.plan.filter((entry) => entry.status === status);
  const created = byStatus('created');
  const updated = [...byStatus('updated'), ...byStatus('overwritten')];
  const unchanged = byStatus('unchanged');
  const modified = byStatus('modified');

  lines.push(
    `Design system artifacts from @elirobinson/ai-patterns@${result.stamp.aiPatternsVersion} ` +
      `(generated against ${REACT_PACKAGE}@${result.stamp.reactVersion}, ` +
      `@elirobinson/tokens@${result.stamp.tokensVersion})`,
    '',
  );

  const verb = result.wrote ? ['Created', 'Updated'] : ['Would create', 'Would update'];

  if (created.length) {
    lines.push(`${verb[0]} ${created.length}:`, ...created.map((entry) => `  ${entry.target}`), '');
  }
  if (updated.length) {
    lines.push(`${verb[1]} ${updated.length}:`, ...updated.map((entry) => `  ${entry.target}`), '');
  }
  if (unchanged.length) {
    lines.push(`Already current: ${unchanged.length} file${unchanged.length === 1 ? '' : 's'}`, '');
  }

  if (modified.length) {
    lines.push(
      `Left untouched — locally edited (${modified.length}):`,
      ...modified.map((entry) => `  ${entry.target}  (${entry.reason})`),
      '',
      'These files differ from both the shipped copy and the last one this command wrote,',
      'so your changes stayed. Reconcile them by hand, or pass --force to take the shipped',
      'copy and lose the local edit.',
      '',
    );
  }

  if (!result.wrote && (created.length || updated.length)) {
    lines.push('Run `ds-resync artifacts --write` to apply.');
  }

  if (result.wrote && !created.length && !updated.length && !modified.length) {
    lines.push('Everything was already current.');
  }

  return lines.join('\n').trimEnd();
}

function hashOnDisk(cwd, target) {
  const path = join(cwd, target);
  if (!existsSync(path)) return null;
  return sha256(readFileSync(path));
}

function applyPlan(cwd, set, plan) {
  for (const entry of plan) {
    if (!WRITTEN_STATUSES.has(entry.status)) continue;
    const file = set.files.find((candidate) => candidate.path === entry.path);
    const destination = join(cwd, entry.target);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, file.contents);
  }
}

/**
 * @param {object} options
 * @param {string} options.cwd consuming repo root
 * @param {boolean} [options.write] apply, rather than report
 * @param {boolean} [options.force] overwrite locally-edited files
 * @param {string} [options.dir] staged artifact tree, for tests
 */
export function runArtifacts({ cwd, write = false, force = false, dir }) {
  const set = readArtifactSet(dir);
  const record = readRecord(cwd);

  const onDisk = {};
  for (const file of set.files) {
    const target = `${set.targetRoot}/${file.path}`;
    onDisk[target] = hashOnDisk(cwd, target);
  }

  const plan = planWrite({
    files: set.files,
    targetRoot: set.targetRoot,
    recorded: record.files,
    onDisk,
    force,
  });

  const drift = checkDrift({
    stamp: set.stamp,
    installed: readInstalledVersion(cwd, REACT_PACKAGE),
  });

  if (write) {
    applyPlan(cwd, set, plan);

    const destination = join(cwd, RECORD_PATH);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      `${JSON.stringify(
        {
          $comment: `Written by \`ds-resync artifacts\`. Do not edit by hand — re-run the command. Hashes here are what the command last wrote, and are what lets it tell an upgrade from one of your edits.`,
          aiPatternsVersion: set.stamp.aiPatternsVersion,
          reactVersion: set.stamp.reactVersion,
          tokensVersion: set.stamp.tokensVersion,
          files: recordFrom(plan, record.files),
        },
        null,
        2,
      )}\n`,
    );
  }

  return { stamp: set.stamp, plan, drift, wrote: write, recordPath: RECORD_PATH };
}
