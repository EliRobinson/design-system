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

  // Tracks the pnpm-workspace.yaml globs rather than a subset of them. apps/
  // is installed, so drift there would surface as a lockfile mismatch anyway —
  // it is here so the sweep needs no explanation, not because it catches
  // anything templates/ does not.
  for (const workspaceDir of ['packages', 'apps']) {
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

// templates/ is deliberately outside the pnpm workspace globs, so its manifests
// are scaffold source rather than installable packages — which is exactly why
// they need sweeping. Nothing installs them here, so nothing ever surfaces the
// drift: templates/default-app sat on "@elirobinson/react": "^0.1.0" while the
// workspace shipped 2.1.5, and `pnpm sync:deps` still reported "in sync".
//
// The scaffolder rewrites both ranges when it generates an app, so the stale
// values are inert on that path — but the template is a tracked manifest that
// people also copy by hand, and on that path the declared ranges are the only
// thing they get. Walk recursively: templates/ holds whole app trees, not a
// flat list of package directories.
function getTemplatePackageJsonPaths(dir = join(root, 'templates'), paths = []) {
  let entries;

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return paths; // templates/ missing.
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      continue;
    }

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      getTemplatePackageJsonPaths(fullPath, paths);
    } else if (entry.name === 'package.json') {
      paths.push(fullPath);
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

// Workspace manifests get an exact pin: they are published, and an exact
// internal pin is what a consumer should receive. Template manifests are copied
// into standalone apps instead, where a caret is the right consumer default —
// and where an exact pin would contradict the scaffolder, which writes
// `^${version}`. Preserve whatever operator the template already declares so
// syncing changes the version and nothing else.
const exactSpec = (currentSpec, latestVersion) => latestVersion;

function rangePreservingSpec(currentSpec, latestVersion) {
  const [, operator = ''] = /^([~^]?)\d/.exec(currentSpec) ?? [];
  return `${operator}${latestVersion}`;
}

function syncInternalDependencyVersions(packageJsonPaths, versionMap, toSpec) {
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

        const latestSpec = toSpec(version, versionMap.get(name));

        if (version !== latestSpec) {
          deps[name] = latestSpec;
          changed = true;
          console.log(
            `sync-workspace-deps: ${packageJsonPath} ${field}.${name} ${version} -> ${latestSpec}`,
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

const workspacePackageJsonPaths = getWorkspacePackageJsonPaths();
const templatePackageJsonPaths = getTemplatePackageJsonPaths();
const versionMap = buildWorkspaceVersionMap(workspacePackageJsonPaths);
const updatedWorkspacePaths = syncInternalDependencyVersions(
  workspacePackageJsonPaths,
  versionMap,
  exactSpec,
);
const updatedTemplatePaths = syncInternalDependencyVersions(
  templatePackageJsonPaths,
  versionMap,
  rangePreservingSpec,
);
const updatedPackageJsonPaths = [...updatedWorkspacePaths, ...updatedTemplatePaths];
// Template manifests are outside the workspace, so rewriting one cannot make
// the lockfile stale. Only a workspace edit — or a lockfile that was already
// stale — is worth an install.
const needsInstall = updatedWorkspacePaths.length > 0 || isLockfileOutOfSync();

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
