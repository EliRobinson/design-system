import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A leading operator (or none) followed by a bare x.y.z. Anything more
// interesting — unions, wildcards, workspace and git protocols — is left for a
// human, because rewriting it would silently change the consumer's intent.
const SIMPLE_RANGE = /^(\^|~|>=|>|<=|<|=)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?)$/;

const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
];

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

export function detectPackageManager(cwd) {
  for (const [lockfile, packageManager] of LOCKFILES) {
    if (existsSync(join(cwd, lockfile))) return packageManager;
  }
  return 'pnpm';
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
