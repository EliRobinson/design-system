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
 * 2. **Describe what is installed.** The reference skill and the token
 *    stylesheets are generated from the `@elirobinson/react` and
 *    `@elirobinson/tokens` this repo has installed, not copied from the
 *    snapshot staged when ai-patterns was packed (#257). So "Already current"
 *    means "matches what is installed". Only when either package is missing or
 *    unreadable does the bundled snapshot stand in, and the report says so; if
 *    that snapshot names a different react than the installed one, it is
 *    reported loudly as STALE SNAPSHOT, whether or not anything is written.
 *
 * The planning half is pure so both guarantees are testable without a
 * filesystem; `readArtifactSet`, `fromInstalled` and `applyPlan` are the parts
 * that touch disk.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REACT_PKG, TOKENS_PKG } from '../cli/discovery.mjs';
import { DLX } from '../artifacts/llms.mjs';
import { buildReferenceSkill, REFERENCE_INPUTS, SOURCE_KINDS } from '../artifacts/reference.mjs';
import { SKILL_DIRS } from '../artifacts/skills.mjs';
import { CONTRACTS_PATH } from '../server/prompt.mjs';
import { readInstalledSources, resolveIn } from './installed.mjs';

/** Where the record of what we wrote lives, relative to the consuming repo root. */
export const RECORD_PATH = '.claude/ds-artifacts.json';

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
  const inputsPath = join(dir, REFERENCE_INPUTS);

  return {
    stamp,
    targetRoot: stamp.targetRoot ?? '.claude/skills',
    files: stamp.files.map((entry) => ({
      ...entry,
      contents: readFileSync(join(dir, 'skills', entry.path)),
    })),
    referenceInputs: existsSync(inputsPath) ? JSON.parse(readFileSync(inputsPath, 'utf8')) : null,
    keptBundled: [],
  };
}

/** A path inside an installed package, or null if it would leave the package. */
function insidePackage(root, path) {
  const target = join(root, ...path.split('/'));
  const rel = relative(root, target);
  return rel.startsWith('..') || rel.split(sep).includes('..') ? null : target;
}

/** Where a package-sourced file lives in the installed package: through the
 *  exports map when it is exported, by path when it is not (the fonts). */
function installedPath(source, roots) {
  const root = roots[source.package];
  if (source.specifier) {
    try {
      return resolveIn(root, source.specifier);
    } catch {
      // Unexported in this version: fall through to the path.
    }
  }
  return insidePackage(root, source.path);
}

/* `url(...)` and `@import '...'` targets in a stylesheet, relative ones only.
   Comments are stripped first: tokens.css quotes both forms in prose. */
const CSS_REFERENCE = /url\(\s*['"]?([^'")]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g;

function relativeReferences(css) {
  const found = new Set();
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(CSS_REFERENCE)) {
    const ref = (match[1] ?? match[2]).split(/[?#]/)[0];
    if (!/^([a-z]+:|\/|data:)/i.test(ref)) found.add(ref);
  }
  return [...found];
}

/**
 * The file set a consumer gets from the installed packages.
 *
 * The staged set fixes which files exist; the installed packages decide their
 * bytes. Every `reference` file is rebuilt from the installed react manifest
 * and tokens, and every `package` file is copied from the installed package.
 * Then each copied stylesheet's relative `url()` and `@import` targets are
 * followed, so a font or stylesheet a newer tokens release added is written
 * too, instead of leaving `fonts.css` pointing at a file that is not there.
 * Anything that cannot be found is kept from the bundle and reported.
 *
 * Pure apart from reading the installed package files it names.
 *
 * @param {ReturnType<typeof readArtifactSet>} set
 * @param {Extract<Awaited<ReturnType<typeof readInstalledSources>>, {ok: true}>} installed
 * @param {object} contracts `src/contracts.json`
 */
export function fromInstalled(set, installed, contracts) {
  if (!set.referenceInputs) {
    throw new Error(`The staged artifacts have no ${REFERENCE_INPUTS}. Rebuild ai-patterns.`);
  }
  const versions = {
    aiPatterns: set.stamp.aiPatternsVersion,
    react: installed.reactVersion,
    tokens: installed.tokensVersion,
  };
  const readme = set.files.find((file) => file.path === `${SKILL_DIRS.brand}/README.md`);
  if (!readme) throw new Error(`The staged artifacts have no ${SKILL_DIRS.brand}/README.md.`);
  const reference = buildReferenceSkill({
    manifest: installed.manifest,
    contracts,
    tokens: installed.tokens,
    versions,
    brand: { ...set.referenceInputs.brand, readme: readme.contents.toString('utf8') },
  });

  const keptBundled = [];
  const withContents = (file, contents) => ({ ...file, contents, hash: sha256(contents) });

  const resolveContents = {
    [SOURCE_KINDS.reference]: (file) => {
      if (!(file.path in reference)) {
        throw new Error(`The reference builder made no ${file.path}.`);
      }
      return withContents(file, Buffer.from(reference[file.path]));
    },
    [SOURCE_KINDS.package]: (file) => {
      const path = installedPath(file.source, installed.roots);
      if (path && existsSync(path)) return withContents(file, readFileSync(path));
      keptBundled.push(`${file.path} (${file.source.package} has no ${file.source.path})`);
      return file;
    },
  };

  const files = set.files.map((file) =>
    file.source ? resolveContents[file.source.kind](file) : file,
  );

  // Follow what the installed stylesheets reference.
  const byPath = new Map(files.map((file) => [file.path, file]));
  const queue = files.filter((file) => file.source?.kind === SOURCE_KINDS.package);
  while (queue.length) {
    const file = queue.shift();
    if (!file.path.endsWith('.css')) continue;
    for (const ref of relativeReferences(file.contents.toString('utf8'))) {
      const path = posix.normalize(posix.join(posix.dirname(file.path), ref));
      if (byPath.has(path) || path.startsWith('..')) continue;
      const source = {
        kind: SOURCE_KINDS.package,
        package: file.source.package,
        path: posix.normalize(posix.join(posix.dirname(file.source.path), ref)),
      };
      const from = installedPath(source, installed.roots);
      if (!from || !existsSync(from)) {
        keptBundled.push(`${path} (referenced by ${file.path}, missing from ${source.package})`);
        byPath.set(path, null);
        continue;
      }
      const added = withContents({ path, source }, readFileSync(from));
      byPath.set(path, added);
      files.push(added);
      queue.push(added);
    }
  }

  return {
    ...set,
    stamp: { ...set.stamp, reactVersion: versions.react, tokensVersion: versions.tokens },
    files,
    keptBundled,
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
  return { kind: 'snapshot', expected: stamp.reactVersion, installed };
}

/**
 * On the installed path the files are always generated from what is installed,
 * so the drift that matters is the repo's: artifacts last written for other
 * versions than the ones installed now. A react or tokens bump that nobody
 * re-ran `--write` for is exactly what `--fail-on-drift` exists to catch in CI.
 * Null when nothing was written yet, since there is nothing on disk to be stale.
 */
export function checkRecordDrift({ record, installed }) {
  if (!record.reactVersion && !record.tokensVersion) return null;
  const stale = [
    [REACT_PKG, record.reactVersion, installed.reactVersion],
    [TOKENS_PKG, record.tokensVersion, installed.tokensVersion],
  ].filter(([, written, now]) => written !== now);
  if (stale.length === 0) return null;
  return {
    kind: 'record',
    packages: stale.map(([name, written, now]) => ({ name, written: written ?? 'none', now })),
  };
}

export function formatDriftWarning(drift) {
  if (drift.kind === 'record') {
    return [
      '!!  OUT OF DATE',
      '!!  The artifacts in this repo were written for other versions than the installed ones:',
      ...drift.packages.map(
        (entry) => `!!    ${entry.name}: written for ${entry.written}, installed ${entry.now}`,
      ),
      '!!  Regenerate them from what is installed:',
      `!!    ${DLX} ds-resync artifacts --write`,
    ].join('\n');
  }
  return [
    '!!  STALE SNAPSHOT',
    `!!  These artifacts describe ${REACT_PKG}@${drift.expected}, but this repo has`,
    `!!  ${drift.installed} installed. Component and prop tables in llms-full.txt may name`,
    '!!  props that do not exist at the installed version, and omit ones that do.',
    '!!',
    '!!  They came from the bundled snapshot because the installed packages could not be',
    '!!  read (the reason is below). Install or upgrade the package it names, then:',
    `!!    ${DLX} ds-resync artifacts --write   # regenerate from what is installed`,
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

  const versions =
    `${REACT_PKG}@${result.stamp.reactVersion} and ` +
    `${TOKENS_PKG}@${result.stamp.tokensVersion}`;
  lines.push(
    `Design system artifacts from @elirobinson/ai-patterns@${result.stamp.aiPatternsVersion},`,
  );
  if (result.source === 'installed') {
    lines.push(`generated from the installed ${versions}.`, '');
  } else {
    lines.push(
      `using the bundled snapshot (${versions}) because ${result.fallbackReason}.`,
      'Install or upgrade the package named above, then re-run to generate from what is installed.',
      '',
    );
  }
  if (result.keptBundled.length) {
    lines.push('Kept the bundled copy of:', ...result.keptBundled.map((entry) => `  ${entry}`), '');
  }

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
export async function runArtifacts({ cwd, write = false, force = false, dir = artifactsDir() }) {
  const staged = readArtifactSet(dir);
  const installed = await readInstalledSources(cwd);
  let set = staged;
  if (installed.ok) {
    try {
      set = fromInstalled(staged, installed, JSON.parse(readFileSync(CONTRACTS_PATH, 'utf8')));
    } catch (error) {
      /* Readable but unusable — an empty manifest, stylesheets with no tokens.
         The promise is a fallback with a reason, not a crash. */
      Object.assign(installed, {
        ok: false,
        reason: `the installed packages produced no usable reference (${error.message})`,
      });
    }
  }
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

  /* After a write the record matches what is installed, so only a dry run
     can find the repo's own artifacts out of date. */
  const drift = installed.ok
    ? write
      ? null
      : checkRecordDrift({ record, installed })
    : checkDrift({ stamp: set.stamp, installed: installed.reactVersion });

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

  return {
    stamp: set.stamp,
    source: installed.ok ? 'installed' : 'bundled',
    fallbackReason: installed.ok ? null : installed.reason,
    keptBundled: set.keptBundled,
    plan,
    drift,
    wrote: write,
    recordPath: RECORD_PATH,
  };
}
