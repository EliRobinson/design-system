import { readFileSync, writeFileSync } from 'node:fs';
import { findLockfile } from './lockfile.mjs';

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

export function installCommand(packageManager) {
  return INSTALL_COMMANDS[packageManager] ?? INSTALL_COMMANDS.pnpm;
}
