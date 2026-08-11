import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detect, findScopedDependencies, readInstalledVersion } from './detect.mjs';

function makeRepo(packageJson, installed = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-resync-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));

  for (const [name, version] of Object.entries(installed)) {
    const packageDir = join(dir, 'node_modules', name);
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name, version }));
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

describe('readInstalledVersion', () => {
  it('reads the resolved version from node_modules', () => {
    const dir = makeRepo(
      { dependencies: { '@elirobinson/react': '^1.0.0' } },
      { '@elirobinson/react': '1.1.0' },
    );
    expect(readInstalledVersion(dir, '@elirobinson/react')).toBe('1.1.0');
  });

  it('returns null when the package is not installed', () => {
    const dir = makeRepo({ dependencies: { '@elirobinson/react': '^1.0.0' } });
    expect(readInstalledVersion(dir, '@elirobinson/react')).toBeNull();
  });
});

describe('detect', () => {
  it('pairs declared ranges with installed versions', () => {
    const dir = makeRepo(
      {
        dependencies: { '@elirobinson/react': '^1.0.0', '@elirobinson/tokens': '^0.2.0' },
      },
      { '@elirobinson/react': '1.1.0' },
    );

    expect(detect(dir).packages).toEqual([
      {
        name: '@elirobinson/react',
        declaredRange: '^1.0.0',
        field: 'dependencies',
        installedVersion: '1.1.0',
      },
      {
        name: '@elirobinson/tokens',
        declaredRange: '^0.2.0',
        field: 'dependencies',
        installedVersion: null,
      },
    ]);
  });

  it('throws a directed error when there is no package.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-resync-empty-'));
    expect(() => detect(dir)).toThrow(/No package\.json/);
  });
});
