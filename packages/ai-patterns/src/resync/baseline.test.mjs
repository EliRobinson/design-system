/* What `ds-resync` measures staleness against.
 *
 * The bug these tests pin: the baseline used to be `node_modules`, so a repo
 * whose install had drifted ahead of its committed manifests was reported as
 * nearly current while the state CI actually builds was majors behind.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./registry.mjs', () => ({
  RegistryError: class RegistryError extends Error {},
  fetchAllVersions: vi.fn(() => []),
  fetchChangelog: vi.fn(() => null),
}));

const { fetchAllVersions } = await import('./registry.mjs');
const { main } = await import('./cli.mjs');

/** The state of EliRobinson/next-template when the under-reporting was found. */
const REPORTED = {
  '@elirobinson/react': { declared: '^1.3.0', locked: '1.3.0', installed: '2.0.1' },
  '@elirobinson/tokens': { declared: '^0.3.0', locked: '0.3.0', installed: '0.5.0' },
  '@elirobinson/ai-patterns': { declared: '^0.5.0', locked: '0.5.0', installed: '0.9.0' },
  '@elirobinson/eslint-config': { declared: '^0.2.0', locked: '0.2.0', installed: '0.3.0' },
};

const PUBLISHED = {
  '@elirobinson/react': ['1.3.0', '1.9.0', '2.0.0', '2.0.1'],
  '@elirobinson/tokens': ['0.3.0', '0.4.0', '0.5.0'],
  '@elirobinson/ai-patterns': ['0.5.0', '0.9.0', '0.9.2'],
  '@elirobinson/eslint-config': ['0.2.0', '0.3.0'],
};

function makeRepo(packages, { lockfile = true, nodeModules = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-baseline-'));

  const dependencies = {};
  for (const [name, state] of Object.entries(packages)) dependencies[name] = state.declared;
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', dependencies }, null, 2));

  if (lockfile) {
    const body = Object.entries(packages)
      .filter(([, state]) => state.locked)
      .map(
        ([name, state]) =>
          `      '${name}':\n        specifier: ${state.declared}\n        version: ${state.locked}`,
      )
      .join('\n');
    writeFileSync(
      join(dir, 'pnpm-lock.yaml'),
      `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    dependencies:\n${body}\n`,
    );
  }

  if (nodeModules) {
    for (const [name, state] of Object.entries(packages)) {
      if (!state.installed) continue;
      const packageDir = join(dir, 'node_modules', name);
      mkdirSync(packageDir, { recursive: true });
      writeFileSync(
        join(packageDir, 'package.json'),
        JSON.stringify({ name, version: state.installed }),
      );
    }
  }

  return dir;
}

async function run(argv) {
  const chunks = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(chunk);
    return true;
  };

  let code;
  try {
    code = await main(argv);
  } finally {
    process.stdout.write = original;
  }

  return { code, text: chunks.join('') };
}

async function runJson(argv) {
  const { code, text } = await run([...argv, '--json']);
  return { code, result: JSON.parse(text) };
}

function packageNamed(result, name) {
  return result.packages.find((entry) => entry.name === name);
}

beforeEach(() => {
  fetchAllVersions.mockImplementation((name) => PUBLISHED[name] ?? []);
});

describe('a repo whose node_modules has drifted ahead of its lockfile', () => {
  it('measures staleness from the lockfile, so react is a major behind', async () => {
    const dir = makeRepo(REPORTED);
    const { result } = await runJson(['--cwd', dir]);

    const react = packageNamed(result, '@elirobinson/react');
    expect(react.currentVersion).toBe('1.3.0');
    expect(react.targetVersion).toBe('2.0.1');
    expect(react.jump).toBe('major');
    expect(react.outdated).toBe(true);
  });

  it('reports every behind package, not only the one node_modules disagreed on', async () => {
    const dir = makeRepo(REPORTED);
    const { result } = await runJson(['--cwd', dir]);

    expect(result.packages.filter((entry) => entry.outdated)).toHaveLength(4);
  });

  it('says four packages behind and names the major jump in the human report', async () => {
    const dir = makeRepo(REPORTED);
    const { text } = await run(['--cwd', dir]);

    expect(text).toContain('4 packages behind');
    expect(text).toContain('1.3.0 → 2.0.1');
    expect(text).toMatch(/\(major\)/);
    // The under-reporting this replaces: ai-patterns alone, called a patch.
    expect(text).not.toContain('1 package behind');
  });

  it('keeps the installed and locked versions as separate facts', async () => {
    const dir = makeRepo(REPORTED);
    const { result } = await runJson(['--cwd', dir]);

    expect(packageNamed(result, '@elirobinson/react')).toMatchObject({
      installedVersion: '2.0.1',
      lockedVersion: '1.3.0',
      currentVersion: '1.3.0',
      currentSource: 'lockfile',
    });
  });
});

describe('reporting the drift itself', () => {
  it('names both versions for each drifted package', async () => {
    const dir = makeRepo(REPORTED);
    const { text } = await run(['--cwd', dir]);

    expect(text).toMatch(/do not match the lockfile/i);
    expect(text).toContain('@elirobinson/react');
    expect(text).toContain('lockfile 1.3.0');
    expect(text).toContain('node_modules 2.0.1');
  });

  it('names the fix, which is an install and not an upgrade', async () => {
    const dir = makeRepo(REPORTED);
    const { text } = await run(['--cwd', dir]);
    expect(text).toContain('pnpm install');
  });

  it('warns before the staleness report, not buried under it', async () => {
    const dir = makeRepo(REPORTED);
    const { text } = await run(['--cwd', dir]);

    expect(text.indexOf('do not match the lockfile')).toBeLessThan(
      text.indexOf('4 packages behind'),
    );
  });

  it('lists the drift in the JSON report', async () => {
    const dir = makeRepo(REPORTED);
    const { result } = await runJson(['--cwd', dir]);

    expect(result.drift).toEqual(
      expect.arrayContaining([{ name: '@elirobinson/react', locked: '1.3.0', installed: '2.0.1' }]),
    );
  });

  it('is silent about drift when the install matches the lockfile', async () => {
    const dir = makeRepo({
      '@elirobinson/react': { declared: '^2.0.1', locked: '2.0.1', installed: '2.0.1' },
    });
    const { text } = await run(['--cwd', dir]);

    expect(text).not.toMatch(/do not match the lockfile/i);
    expect(text).toMatch(/up to date/i);
  });
});

describe('a fresh clone with no node_modules', () => {
  it('reports against the lockfile without crashing', async () => {
    const dir = makeRepo(REPORTED, { nodeModules: false });
    const { code, result } = await runJson(['--cwd', dir]);

    expect(code).toBe(0);
    expect(packageNamed(result, '@elirobinson/react')).toMatchObject({
      installedVersion: null,
      currentVersion: '1.3.0',
      currentSource: 'lockfile',
      jump: 'major',
    });
  });

  it('says nothing about drift — there is nothing installed to disagree', async () => {
    const dir = makeRepo(REPORTED, { nodeModules: false });
    const { text } = await run(['--cwd', dir]);
    const { result } = await runJson(['--cwd', dir]);

    expect(text).not.toMatch(/do not match the lockfile/i);
    expect(result.drift).toEqual([]);
  });
});

describe('a repo with no lockfile', () => {
  it('falls back to the declared range and says so', async () => {
    const dir = makeRepo(REPORTED, { lockfile: false });
    const { text } = await run(['--cwd', dir]);
    const { result } = await runJson(['--cwd', dir]);

    expect(packageNamed(result, '@elirobinson/react')).toMatchObject({
      currentVersion: '1.3.0',
      currentSource: 'range',
      lockedVersion: null,
    });
    expect(text).toMatch(/no lockfile/i);
    expect(text).toMatch(/package\.json/);
  });

  it('does not call a range floor drift, however far node_modules has moved', async () => {
    // The floor of `^1.3.0` is not what the range resolved to, so the two are
    // not comparable — and a hoisted node_modules in a workspace looks exactly
    // like this. Guessing here would warn wrongly.
    const dir = makeRepo(REPORTED, { lockfile: false });
    const { text } = await run(['--cwd', dir]);
    const { result } = await runJson(['--cwd', dir]);

    expect(text).not.toMatch(/do not match the lockfile/i);
    expect(result.drift).toEqual([]);
  });
});

describe('a package the lockfile does not mention', () => {
  it('falls back to its declared range and claims no drift for it', async () => {
    const dir = makeRepo({
      '@elirobinson/react': { declared: '^1.3.0', locked: '1.3.0', installed: '1.3.0' },
      '@elirobinson/tokens': { declared: '^0.3.0', locked: null, installed: '0.5.0' },
    });
    const { result } = await runJson(['--cwd', dir]);

    expect(packageNamed(result, '@elirobinson/tokens')).toMatchObject({
      lockedVersion: null,
      currentVersion: '0.3.0',
      currentSource: 'range',
    });
    expect(result.drift).toEqual([]);
  });
});

describe('a range with no version in it', () => {
  // `workspace:*` resolves to `link:packages/react` in the lockfile, so neither
  // side offers a version to compare. Stripping the operator off the range
  // leaves an empty string, which is not a version either.
  function workspaceRepo() {
    const dir = mkdtempSync(join(tmpdir(), 'ds-baseline-ws-'));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@elirobinson/react': 'workspace:*' } }),
    );
    writeFileSync(
      join(dir, 'pnpm-lock.yaml'),
      `importers:\n  .:\n    dependencies:\n      '@elirobinson/react':\n        specifier: workspace:*\n        version: link:packages/react\n`,
    );
    mkdirSync(join(dir, 'node_modules', '@elirobinson', 'react'), { recursive: true });
    writeFileSync(
      join(dir, 'node_modules', '@elirobinson', 'react', 'package.json'),
      JSON.stringify({ version: '2.0.1' }),
    );
    return dir;
  }

  it('reports the package instead of failing on an unparseable version', async () => {
    const { code, result } = await runJson(['--cwd', workspaceRepo()]);

    expect(code).toBe(0);
    expect(packageNamed(result, '@elirobinson/react')).toMatchObject({
      currentVersion: null,
      currentSource: 'unresolved',
      outdated: false,
    });
  });

  it('says why it could not compare, and does not call it up to date', async () => {
    const { text } = await run(['--cwd', workspaceRepo()]);

    expect(text).toContain('workspace:*');
    expect(text).toMatch(/not compared/i);
  });

  it('claims no drift for it — a linked package has no published version', async () => {
    const { result } = await runJson(['--cwd', workspaceRepo()]);
    expect(result.drift).toEqual([]);
  });
});

describe('exit codes', () => {
  const current = {
    '@elirobinson/react': { declared: '^2.0.1', locked: '2.0.1', installed: '2.0.1' },
  };

  it('exits 0 on a clean repo', async () => {
    const { code } = await run(['--cwd', makeRepo(current), '--fail-on-outdated']);
    expect(code).toBe(0);
  });

  it('exits 2 under --fail-on-outdated when the lockfile is behind', async () => {
    const { code } = await run(['--cwd', makeRepo(REPORTED), '--fail-on-outdated']);
    expect(code).toBe(2);
  });

  it('exits 2 under --fail-on-out-of-sync when node_modules disagrees', async () => {
    const drifted = {
      '@elirobinson/react': { declared: '^2.0.1', locked: '2.0.1', installed: '1.3.0' },
    };
    const { code } = await run(['--cwd', makeRepo(drifted), '--fail-on-out-of-sync']);
    expect(code).toBe(2);
  });

  it('does not let drift trip --fail-on-outdated, which is a different finding', async () => {
    const drifted = {
      '@elirobinson/react': { declared: '^2.0.1', locked: '2.0.1', installed: '1.3.0' },
    };
    const { code } = await run(['--cwd', makeRepo(drifted), '--fail-on-outdated']);
    expect(code).toBe(0);
  });

  it('does not let being behind trip --fail-on-out-of-sync', async () => {
    const behind = {
      '@elirobinson/react': { declared: '^1.3.0', locked: '1.3.0', installed: '1.3.0' },
    };
    const { code } = await run(['--cwd', makeRepo(behind), '--fail-on-out-of-sync']);
    expect(code).toBe(0);
  });
});
