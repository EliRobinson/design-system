import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findLockfile } from './lockfile.mjs';
import { UPGRADE_RECORD_PATH } from './migrations.mjs';

// A leading operator (or none) followed by a bare x.y.z. Anything more
// interesting — unions, wildcards, workspace and git protocols — is left for a
// human, because rewriting it would silently change the consumer's intent.
const SIMPLE_RANGE = /^(\^|~|>=|>|<=|<|=)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?)$/;

const INSTALL_COMMANDS = {
  pnpm: { command: 'pnpm', args: ['install'] },
  npm: { command: 'npm', args: ['install'] },
  yarn: { command: 'yarn', args: ['install'] },
};

/**
 * Rewrites a range to a new version, keeping the operator the consumer chose.
 * Returns null when the range is not a simple one — the caller reports those
 * as skipped rather than guessing.
 */
export function bumpRange(declaredRange, newVersion) {
  const match = SIMPLE_RANGE.exec(String(declaredRange).trim());
  if (!match) return null;
  return `${match[1] ?? ''}${newVersion}`;
}

/**
 * Which package manager owns this repo, read off the lockfile that is present —
 * the same lookup that decides which lockfile supplies the staleness baseline,
 * so the two can never disagree about which ecosystem this is.
 */
export function detectPackageManager(cwd) {
  return findLockfile(cwd)?.kind ?? 'pnpm';
}

export function writeVersions(packageJsonPath, updates) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  for (const { name, field, newRange } of updates) {
    if (packageJson[field]?.[name] === undefined) continue;
    packageJson[field][name] = newRange;
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8');
}

/**
 * Records which version range each package was just moved across.
 *
 * `ds-resync migrate` needs both ends and can only recover one: after the
 * install, node_modules says where the repo landed and nothing on disk
 * remembers where it started. Without this the consumer would have to carry the
 * numbers from step 1 of the upgrade to step 4 by hand — which is precisely the
 * "read it out of the report and retype it" work the migrate command exists to
 * delete, reintroduced one step earlier.
 *
 * Merged rather than replaced, so a run with `--only` does not erase the record
 * of the packages it did not touch. Written best-effort: a repo where `.claude`
 * cannot be created still gets its upgrade, and `migrate` falls back to
 * considering every migration and says so.
 */
export function writeUpgradeRecord(cwd, upgrades) {
  if (upgrades.length === 0) return;

  const path = join(cwd, UPGRADE_RECORD_PATH);

  let existing = {};
  try {
    existing = JSON.parse(readFileSync(path, 'utf-8'))?.upgrades ?? {};
  } catch {
    existing = {};
  }

  for (const { name, from, to } of upgrades) {
    existing[name] = { from, to, at: new Date().toISOString() };
  }

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ upgrades: existing }, null, 2)}\n`, 'utf-8');
  } catch {
    /* Best effort. The upgrade itself already succeeded. */
  }
}

export function installCommand(packageManager) {
  return INSTALL_COMMANDS[packageManager] ?? INSTALL_COMMANDS.pnpm;
}
