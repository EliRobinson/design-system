import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bumpRange, detectPackageManager, installCommand, writeVersions } from './apply.mjs';

describe('bumpRange', () => {
  it('preserves the range operator', () => {
    expect(bumpRange('^1.1.0', '1.4.0')).toBe('^1.4.0');
    expect(bumpRange('~1.1.0', '1.4.0')).toBe('~1.4.0');
    expect(bumpRange('>=1.1.0', '1.4.0')).toBe('>=1.4.0');
  });

  it('keeps a pinned dependency pinned', () => {
    expect(bumpRange('1.1.0', '1.4.0')).toBe('1.4.0');
  });

  it('leaves ranges it cannot safely rewrite alone', () => {
    expect(bumpRange('*', '1.4.0')).toBeNull();
    expect(bumpRange('workspace:*', '1.4.0')).toBeNull();
    expect(bumpRange('1.x', '1.4.0')).toBeNull();
    expect(bumpRange('^1.0.0 || ^2.0.0', '1.4.0')).toBeNull();
    expect(bumpRange('github:EliRobinson/design-system', '1.4.0')).toBeNull();
  });
});

describe('detectPackageManager', () => {
  it('reads the lockfile', () => {
    const pnpmDir = mkdtempSync(join(tmpdir(), 'ds-pm-'));
    writeFileSync(join(pnpmDir, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(pnpmDir)).toBe('pnpm');

    const npmDir = mkdtempSync(join(tmpdir(), 'ds-pm-'));
    writeFileSync(join(npmDir, 'package-lock.json'), '{}');
    expect(detectPackageManager(npmDir)).toBe('npm');

    const yarnDir = mkdtempSync(join(tmpdir(), 'ds-pm-'));
    writeFileSync(join(yarnDir, 'yarn.lock'), '');
    expect(detectPackageManager(yarnDir)).toBe('yarn');
  });

  it('defaults to pnpm when there is no lockfile', () => {
    expect(detectPackageManager(mkdtempSync(join(tmpdir(), 'ds-pm-')))).toBe('pnpm');
  });
});

describe('writeVersions', () => {
  it('updates only the named entries, in their own dependency block', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-write-'));
    const path = join(dir, 'package.json');
    writeFileSync(
      path,
      `${JSON.stringify(
        {
          name: 'app',
          dependencies: { '@elirobinson/react': '^1.0.0', next: '^15.3.1' },
          devDependencies: { '@elirobinson/tokens': '^0.2.0' },
        },
        null,
        2,
      )}\n`,
    );

    writeVersions(path, [
      { name: '@elirobinson/react', field: 'dependencies', newRange: '^1.1.0' },
      { name: '@elirobinson/tokens', field: 'devDependencies', newRange: '^0.3.0' },
    ]);

    const result = JSON.parse(readFileSync(path, 'utf-8'));
    expect(result.dependencies).toEqual({ '@elirobinson/react': '^1.1.0', next: '^15.3.1' });
    expect(result.devDependencies).toEqual({ '@elirobinson/tokens': '^0.3.0' });
  });

  it('writes two-space JSON with a trailing newline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-write-'));
    const path = join(dir, 'package.json');
    writeFileSync(
      path,
      `${JSON.stringify({ dependencies: { '@elirobinson/react': '^1.0.0' } }, null, 2)}\n`,
    );

    writeVersions(path, [
      { name: '@elirobinson/react', field: 'dependencies', newRange: '^1.1.0' },
    ]);

    const raw = readFileSync(path, 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  "dependencies"');
  });
});

describe('installCommand', () => {
  it('maps each package manager to its install invocation', () => {
    expect(installCommand('pnpm')).toEqual({ command: 'pnpm', args: ['install'] });
    expect(installCommand('npm')).toEqual({ command: 'npm', args: ['install'] });
    expect(installCommand('yarn')).toEqual({ command: 'yarn', args: ['install'] });
  });
});
