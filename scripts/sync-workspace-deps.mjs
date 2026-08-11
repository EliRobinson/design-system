#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shouldStage = process.argv.includes('--stage');
const lockfilePath = join(root, 'pnpm-lock.yaml');
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function getWorkspacePackageJsonPaths() {
  const paths = [join(root, 'package.json')];

  for (const workspaceDir of ['packages']) {
    const fullDir = join(root, workspaceDir);

    try {
      for (const entry of readdirSync(fullDir)) {
        const packageJsonPath = join(fullDir, entry, 'package.json');

        try {
          statSync(packageJsonPath);
          paths.push(packageJsonPath);
        } catch {
          // Not a package directory.
        }
      }
    } catch {
      // Workspace directory missing.
    }
  }

  return paths;
}

function buildWorkspaceVersionMap(packageJsonPaths) {
  const versionMap = new Map();

  for (const packageJsonPath of packageJsonPaths) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    if (pkg.name?.startsWith('@elirobinson/') && pkg.version) {
      versionMap.set(pkg.name, pkg.version);
    }
  }

  return versionMap;
}

function syncInternalDependencyVersions(packageJsonPaths, versionMap) {
  const updatedPaths = [];

  for (const packageJsonPath of packageJsonPaths) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    let changed = false;

    for (const field of dependencyFields) {
      const deps = pkg[field];
      if (!deps) {
        continue;
      }

      for (const [name, version] of Object.entries(deps)) {
        if (!versionMap.has(name)) {
          continue;
        }

        if (
          version.startsWith('workspace:') ||
          version.startsWith('link:') ||
          version.startsWith('file:')
        ) {
          continue;
        }

        const latestVersion = versionMap.get(name);

        if (version !== latestVersion) {
          deps[name] = latestVersion;
          changed = true;
          console.log(
            `sync-workspace-deps: ${packageJsonPath} ${field}.${name} ${version} -> ${latestVersion}`,
          );
        }
      }
    }

    if (changed) {
      writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
      updatedPaths.push(packageJsonPath);
    }
  }

  return updatedPaths;
}

function isLockfileOutOfSync() {
  try {
    execSync('pnpm install --frozen-lockfile', {
      cwd: root,
      stdio: 'pipe',
    });
    return false;
  } catch {
    return true;
  }
}

function hasUnstagedChanges(filePath) {
  try {
    execSync(`git diff --quiet -- ${JSON.stringify(filePath)}`, {
      cwd: root,
      stdio: 'pipe',
    });
    return false;
  } catch {
    return true;
  }
}

// Only ever called once we know the lockfile is stale, so the whole point is to
// rewrite it. --no-frozen-lockfile is required rather than merely convenient:
// pnpm defaults frozen-lockfile to true whenever CI=true, which made this fail
// in exactly the situation it exists to repair. `changeset version` bumps an
// internal dependency, the release job commits, this hook fires, and a bare
// `pnpm install` aborts with ERR_PNPM_OUTDATED_LOCKFILE.
//
// Detection stays strict — isLockfileOutOfSync() keeps --frozen-lockfile as its
// read-only probe, so nothing here loosens what counts as out of sync.
function runPnpmInstall() {
  execSync('pnpm install --no-frozen-lockfile', { cwd: root, stdio: 'inherit' });
}

function stagePaths(paths) {
  const uniquePaths = [...new Set(paths)];

  if (uniquePaths.length === 0) {
    return;
  }

  execSync(`git add -- ${uniquePaths.map((path) => JSON.stringify(path)).join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
  });
}

const packageJsonPaths = getWorkspacePackageJsonPaths();
const versionMap = buildWorkspaceVersionMap(packageJsonPaths);
const updatedPackageJsonPaths = syncInternalDependencyVersions(packageJsonPaths, versionMap);
const needsInstall = updatedPackageJsonPaths.length > 0 || isLockfileOutOfSync();

if (needsInstall) {
  runPnpmInstall();
}

const pathsToStage = [...updatedPackageJsonPaths];

if (hasUnstagedChanges(lockfilePath)) {
  pathsToStage.push(lockfilePath);
}

if (shouldStage) {
  stagePaths(pathsToStage);
}

if (updatedPackageJsonPaths.length === 0 && !needsInstall) {
  console.log('sync-workspace-deps: workspace deps and lockfile are in sync');
}
