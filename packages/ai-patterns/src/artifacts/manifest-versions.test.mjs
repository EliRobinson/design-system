/* Every tracked manifest that names an @elirobinson package names the version
 * the workspace actually ships.
 *
 * `pnpm sync:deps` enforces this by rewriting, but it only ever walked
 * packages/. templates/default-app therefore sat on "@elirobinson/react":
 * "^0.1.0" against a workspace shipping 2.x, and the script still reported
 * "in sync" — the drift had nowhere to surface, because templates/ is outside
 * the pnpm workspace so no install resolves it either.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function workspaceManifestPaths() {
  const paths = [join(repoRoot, 'package.json')];

  // Mirrors the pnpm-workspace.yaml globs, and the sweep in
  // scripts/sync-workspace-deps.mjs. apps/storybook carries no manifest at all,
  // which is why each candidate is stat'd rather than assumed.
  for (const workspaceDir of ['packages', 'apps']) {
    for (const entry of readdirSync(join(repoRoot, workspaceDir))) {
      const manifestPath = join(repoRoot, workspaceDir, entry, 'package.json');

      try {
        statSync(manifestPath);
        paths.push(manifestPath);
      } catch {
        // Not a package directory.
      }
    }
  }

  return paths;
}

function templateManifestPaths(dir = join(repoRoot, 'templates'), paths = []) {
  let entries;

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return paths;
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) templateManifestPaths(fullPath, paths);
    else if (entry.name === 'package.json') paths.push(fullPath);
  }

  return paths;
}

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

const workspaceVersions = new Map(
  workspaceManifestPaths()
    .map(read)
    .filter((pkg) => pkg.name?.startsWith('@elirobinson/') && pkg.version)
    .map((pkg) => [pkg.name, pkg.version]),
);

/* Every @elirobinson dep in one manifest, as { field, name, spec }, skipping
 * the protocols that pin to the workspace copy by construction. */
function internalDeps(manifestPath) {
  const pkg = read(manifestPath);

  return dependencyFields.flatMap((field) =>
    Object.entries(pkg[field] ?? {})
      .filter(
        ([name, spec]) => workspaceVersions.has(name) && !/^(workspace|link|file):/.test(spec),
      )
      .map(([name, spec]) => ({ field, name, spec })),
  );
}

const declaredVersion = (spec) => spec.replace(/^[~^]/, '');

describe('internal dependency ranges', () => {
  it.each(
    [...workspaceManifestPaths(), ...templateManifestPaths()].map((path) => [
      relative(repoRoot, path),
      path,
    ]),
  )('%s declares the workspace version', (_label, manifestPath) => {
    for (const { field, name, spec } of internalDeps(manifestPath)) {
      expect(
        `${field}.${name}@${declaredVersion(spec)}`,
        `run \`pnpm sync:deps\` — ${relative(repoRoot, manifestPath)} is behind the workspace`,
      ).toBe(`${field}.${name}@${workspaceVersions.get(name)}`);
    }
  });
});

describe('template manifests', () => {
  const templatePaths = templateManifestPaths();

  it('are actually reachable, so the sweep above is not vacuous', () => {
    // Without this, moving or renaming templates/ turns every assertion here
    // into a no-op that still passes.
    expect(templatePaths.length).toBeGreaterThan(0);
    expect(templatePaths.map((path) => relative(repoRoot, path))).toContain(
      join('templates', 'default-app', 'package.json'),
    );
  });

  it('declare the caret ranges the scaffolder writes', () => {
    // create-elirobinson-design-system rewrites these to `^${version}` when it
    // generates an app. A template that pins exactly would contradict its own
    // generator for anyone copying the directory by hand.
    for (const manifestPath of templatePaths) {
      for (const { name, spec } of internalDeps(manifestPath)) {
        expect(spec, `${relative(repoRoot, manifestPath)} ${name}`).toBe(
          `^${workspaceVersions.get(name)}`,
        );
      }
    }
  });
});
