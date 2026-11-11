import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detect, findDrift, findScopedDependencies } from './detect.mjs';

function makeRepo(packageJson, installed = {}, locked = null) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-resync-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));

  for (const [name, version] of Object.entries(installed)) {
    const packageDir = join(dir, 'node_modules', name);
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name, version }));
  }

  if (locked) {
    const body = Object.entries(locked)
      .map(([name, version]) => `      '${name}':\n        version: ${version}`)
      .join('\n');
    writeFileSync(join(dir, 'pnpm-lock.yaml'), `importers:\n  .:\n    dependencies:\n${body}\n`);
  }

  return dir;
}

describe('findScopedDependencies', () => {
  it('collects scoped packages across all three dependency blocks', () => {
    expect(
      findScopedDependencies({
        dependencies: { '@elirobinson/react': '^1.1.0', next: '^15.3.1' },
        devDependencies: { '@elirobinson/tokens': '^0.2.0', vitest: '^3.2.4' },
        peerDependencies: { '@elirobinson/ai-patterns': '^0.3.0' },
      }),
    ).toEqual([
      { name: '@elirobinson/ai-patterns', declaredRange: '^0.3.0', field: 'peerDependencies' },
      { name: '@elirobinson/react', declaredRange: '^1.1.0', field: 'dependencies' },
      { name: '@elirobinson/tokens', declaredRange: '^0.2.0', field: 'devDependencies' },
    ]);
  });

  it('ignores packages outside the scope, including near-misses', () => {
    expect(
      findScopedDependencies({
        dependencies: { '@elirobinsonx/react': '^1.0.0', elirobinson: '^1.0.0' },
      }),
    ).toEqual([]);
  });

  it('returns an empty list when there are no dependency blocks at all', () => {
    expect(findScopedDependencies({ name: 'app' })).toEqual([]);
  });
});

describe('detect, installed version', () => {
  it('reads the resolved version from node_modules', () => {
    const dir = makeRepo(
      { dependencies: { '@elirobinson/react': '^1.0.0' } },
      { '@elirobinson/react': '1.1.0' },
    );
    expect(detect(dir).packages[0].installedVersion).toBe('1.1.0');
  });

  it('is null when the package is not installed', () => {
    const dir = makeRepo({ dependencies: { '@elirobinson/react': '^1.0.0' } });
    expect(detect(dir).packages[0].installedVersion).toBeNull();
  });

  it('finds a package that only a parent node_modules holds', () => {
    const root = makeRepo({ workspaces: ['packages/*'] }, { '@elirobinson/react': '1.1.0' });
    const member = join(root, 'packages', 'app');
    mkdirSync(member, { recursive: true });
    writeFileSync(
      join(member, 'package.json'),
      JSON.stringify({ dependencies: { '@elirobinson/react': '^1.0.0' } }),
    );

    expect(detect(member).packages[0].installedVersion).toBe('1.1.0');
  });
});

describe('detect, from a workspace member', () => {
  it('sees the hoisted install, and reports no drift without a member lockfile', () => {
    const root = makeRepo({ workspaces: ['packages/*'] }, { '@elirobinson/react': '1.1.0' });
    const member = join(root, 'packages', 'app');
    mkdirSync(member, { recursive: true });
    writeFileSync(
      join(member, 'package.json'),
      JSON.stringify({ dependencies: { '@elirobinson/react': '^1.0.0' } }),
    );

    const { packages } = detect(member);

    expect(packages[0].installedVersion).toBe('1.1.0');
    expect(packages[0].lockedVersion).toBeNull();
    expect(findDrift(packages)).toEqual([]);
  });
});

describe('detect, with a lockfile above the project', () => {
  it('reads a workspace member from the root lockfile and counts drift against the root install', () => {
    const root = makeRepo({ workspaces: ['packages/*'] }, { '@elirobinson/react': '1.1.0' });
    writeFileSync(
      join(root, 'pnpm-lock.yaml'),
      [
        'importers:',
        '  .:',
        '    dependencies:',
        "      '@elirobinson/react':",
        '        version: 9.9.9',
        '  packages/app:',
        '    dependencies:',
        "      '@elirobinson/react':",
        '        version: 1.3.0',
        '',
      ].join('\n'),
    );
    const member = join(root, 'packages', 'app');
    mkdirSync(member, { recursive: true });
    writeFileSync(
      join(member, 'package.json'),
      JSON.stringify({ dependencies: { '@elirobinson/react': '^1.0.0' } }),
    );

    const { packages } = detect(member);

    expect(packages[0].lockedVersion).toBe('1.3.0');
    expect(findDrift(packages)).toEqual([
      { name: '@elirobinson/react', locked: '1.3.0', installed: '1.1.0' },
    ]);
  });

  it('reports no drift when the only install is an ancestor of the lockfile', () => {
    const outer = makeRepo({}, { '@elirobinson/react': '1.1.0' });
    const project = join(outer, 'apps', 'site');
    mkdirSync(project, { recursive: true });
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({ dependencies: { '@elirobinson/react': '^1.0.0' } }),
    );
    writeFileSync(
      join(project, 'pnpm-lock.yaml'),
      "importers:\n  .:\n    dependencies:\n      '@elirobinson/react':\n        version: 1.3.0\n",
    );

    const { packages } = detect(project);

    expect(packages[0].installedVersion).toBe('1.1.0');
    expect(packages[0].lockedVersion).toBe('1.3.0');
    expect(findDrift(packages)).toEqual([]);
  });
});

describe('detect', () => {
  it('pairs declared ranges with installed and locked versions', () => {
    const dir = makeRepo(
      {
        dependencies: { '@elirobinson/react': '^1.0.0', '@elirobinson/tokens': '^0.2.0' },
      },
      { '@elirobinson/react': '1.1.0' },
      { '@elirobinson/react': '1.1.0' },
    );

    expect(detect(dir).packages).toEqual([
      {
        name: '@elirobinson/react',
        declaredRange: '^1.0.0',
        field: 'dependencies',
        installedVersion: '1.1.0',
        installedUnderLock: true,
        lockedVersion: '1.1.0',
      },
      {
        name: '@elirobinson/tokens',
        declaredRange: '^0.2.0',
        field: 'dependencies',
        installedVersion: null,
        installedUnderLock: false,
        lockedVersion: null,
      },
    ]);
  });

  it('reports the locked version even when nothing is installed', () => {
    const dir = makeRepo(
      { dependencies: { '@elirobinson/react': '^1.3.0' } },
      {},
      { '@elirobinson/react': '1.3.0' },
    );

    expect(detect(dir).packages[0]).toMatchObject({
      installedVersion: null,
      lockedVersion: '1.3.0',
    });
  });

  it('reports installed and locked separately when they disagree', () => {
    const dir = makeRepo(
      { dependencies: { '@elirobinson/react': '^1.3.0' } },
      { '@elirobinson/react': '2.0.1' },
      { '@elirobinson/react': '1.3.0' },
    );

    expect(detect(dir).packages[0]).toMatchObject({
      installedVersion: '2.0.1',
      lockedVersion: '1.3.0',
    });
  });

  it('throws a directed error when there is no package.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-resync-empty-'));
    expect(() => detect(dir)).toThrow(/No package\.json/);
  });
});
