import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatReport, main, parseArgs, parseArtifactsArgs } from './cli.mjs';

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

describe('parseArgs', () => {
  it('defaults to a read-only run in the process cwd', () => {
    const args = parseArgs([]);
    expect(args.write).toBe(false);
    expect(args.json).toBe(false);
    expect(args.failOnOutdated).toBe(false);
    expect(args.cwd).toBe(process.cwd());
  });

  it('reads every supported flag', () => {
    const args = parseArgs(['--write', '--json', '--fail-on-outdated', '--cwd', '/tmp/app']);
    expect(args.write).toBe(true);
    expect(args.json).toBe(true);
    expect(args.failOnOutdated).toBe(true);
    expect(args.cwd).toContain('app');
  });

  it('accepts --cwd=value as well as --cwd value', () => {
    expect(parseArgs(['--cwd=/tmp/app']).cwd).toContain('app');
  });

  it('rejects an unknown flag rather than ignoring it', () => {
    expect(() => parseArgs(['--wirte'])).toThrow(/Unknown option/);
  });

  it('recognises help', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });
});

describe('formatReport', () => {
  const outdated = {
    packages: [
      {
        name: '@elirobinson/react',
        declaredRange: '^1.0.0',
        installedVersion: '1.0.2',
        targetVersion: '2.0.0',
        latestVersion: '2.0.0',
        jump: 'major',
        outdated: true,
        entries: [{ version: '2.0.0', body: '### Major Changes\n\n- abc: Removed ghost.' }],
      },
      {
        name: '@elirobinson/tokens',
        declaredRange: '^0.2.0',
        installedVersion: '0.2.0',
        targetVersion: '0.2.0',
        latestVersion: '0.2.0',
        jump: 'none',
        outdated: false,
        entries: [],
      },
    ],
    wrote: false,
  };

  it('shows the version transition and flags the breaking jump', () => {
    const text = formatReport(outdated);
    expect(text).toContain('@elirobinson/react');
    expect(text).toContain('1.0.2');
    expect(text).toContain('2.0.0');
    expect(text).toMatch(/breaking/i);
    expect(text).toContain('Removed ghost.');
  });

  it('says how to apply the upgrade on a read-only run', () => {
    expect(formatReport(outdated)).toContain('--write');
  });

  it('reports an all-current repo without suggesting anything', () => {
    const text = formatReport({
      packages: [
        {
          name: '@elirobinson/tokens',
          declaredRange: '^0.2.0',
          installedVersion: '0.2.0',
          targetVersion: '0.2.0',
          latestVersion: '0.2.0',
          jump: 'none',
          outdated: false,
          entries: [],
        },
      ],
      wrote: false,
    });
    expect(text).toMatch(/up to date/i);
    expect(text).not.toContain('--write');
  });

  it('reports a repo with no design-system dependencies', () => {
    expect(formatReport({ packages: [], wrote: false })).toMatch(/No @elirobinson/);
  });

  it('still reports what changed when the install exits non-zero', () => {
    const text = formatReport({
      packages: [
        {
          name: '@elirobinson/react',
          declaredRange: '^1.0.0',
          installedVersion: '1.0.2',
          targetVersion: '1.1.0',
          latestVersion: '1.1.0',
          jump: 'minor',
          outdated: true,
          entries: [],
        },
      ],
      wrote: true,
      installError: '`pnpm install` exited 1',
    });
    // The rewrite already happened, so the transition must still be visible.
    expect(text).toContain('1.0.2');
    expect(text).toContain('1.1.0');
    expect(text).toContain('package.json was updated');
    expect(text).toMatch(/by hand/i);
  });

  it('notes when a range was too complex to rewrite', () => {
    const text = formatReport({
      packages: [
        {
          name: '@elirobinson/react',
          declaredRange: '^1.0.0 || ^2.0.0',
          installedVersion: '1.0.2',
          targetVersion: '2.0.0',
          latestVersion: '2.0.0',
          jump: 'major',
          outdated: true,
          entries: [],
          skipped: true,
        },
      ],
      wrote: true,
    });
    expect(text).toMatch(/left unchanged/i);
  });
});

describe('parseArgs — selection', () => {
  it('defaults to every package at latest', () => {
    const args = parseArgs([]);
    expect(args.only).toBeNull();
    expect(args.targetSpec).toEqual({ fallback: 'latest', byName: {} });
    expect(args.interactive).toBe(false);
  });

  it('reads --only with short names', () => {
    expect(parseArgs(['--only', 'react,tokens']).only).toEqual([
      '@elirobinson/react',
      '@elirobinson/tokens',
    ]);
  });

  it('reads --only=value', () => {
    expect(parseArgs(['--only=react']).only).toEqual(['@elirobinson/react']);
  });

  it('reads a global --target', () => {
    expect(parseArgs(['--target', 'minor']).targetSpec).toEqual({
      fallback: 'minor',
      byName: {},
    });
  });

  it('reads per-package targets', () => {
    expect(parseArgs(['--target=react=patch']).targetSpec).toEqual({
      fallback: 'latest',
      byName: { '@elirobinson/react': 'patch' },
    });
  });

  it('rejects an unknown target', () => {
    expect(() => parseArgs(['--target', 'sideways'])).toThrow(/Unknown target/);
  });

  it('reads --interactive and -i', () => {
    expect(parseArgs(['--interactive']).interactive).toBe(true);
    expect(parseArgs(['-i']).interactive).toBe(true);
  });
});

describe('formatReport — held back', () => {
  function entry(overrides) {
    return {
      name: '@elirobinson/react',
      declaredRange: '^1.0.0',
      installedVersion: '1.0.2',
      targetVersion: '1.4.0',
      latestVersion: '2.0.0',
      target: 'minor',
      jump: 'minor',
      outdated: true,
      heldBack: true,
      entries: [],
      ...overrides,
    };
  }

  it('reports the target version, not the latest, as the transition', () => {
    const text = formatReport({ packages: [entry()], wrote: false });
    expect(text).toContain('1.0.2 → 1.4.0');
    expect(text).not.toContain('1.0.2 → 2.0.0');
  });

  it('names the version being held back and why', () => {
    const text = formatReport({ packages: [entry()], wrote: false });
    expect(text).toContain('2.0.0 is available');
    expect(text).toContain('--target minor');
  });

  it('omits the held-back line when the target is the latest', () => {
    const text = formatReport({
      packages: [entry({ targetVersion: '2.0.0', heldBack: false, jump: 'major' })],
      wrote: false,
    });
    expect(text).not.toContain('is available, held back');
  });

  it('still notes a held-back version on an otherwise current package', () => {
    const text = formatReport({
      packages: [entry({ targetVersion: '1.0.2', outdated: false, heldBack: true, jump: 'none' })],
      wrote: false,
    });
    expect(text).toMatch(/up to date/i);
    expect(text).toContain('2.0.0 is available');
  });
});

describe('the artifacts subcommand', () => {
  it('does not disturb the default run — `artifacts` is only a subcommand, never a flag', () => {
    // Regression guard for the version-sync path: everything below `artifacts`
    // in argv goes to the old parser, unchanged.
    expect(() => parseArgs(['artifacts'])).toThrow(/Unknown option/);
    expect(parseArgs(['--write', '--json']).write).toBe(true);
  });

  it('is read-only by default, like the command it hangs off', () => {
    const args = parseArtifactsArgs([]);
    expect(args.write).toBe(false);
    expect(args.force).toBe(false);
    expect(args.failOnDrift).toBe(false);
    expect(args.cwd).toBe(process.cwd());
  });

  it('reads every supported flag, in both --cwd forms', () => {
    const args = parseArtifactsArgs([
      '--write',
      '--force',
      '--json',
      '--fail-on-drift',
      '--cwd',
      '/tmp/app',
    ]);
    expect(args).toMatchObject({ write: true, force: true, json: true, failOnDrift: true });
    expect(args.cwd).toContain('app');
    expect(parseArtifactsArgs(['--cwd=/tmp/app']).cwd).toContain('app');
  });

  it('rejects a flag that only the other command understands', () => {
    expect(() => parseArtifactsArgs(['--target', 'minor'])).toThrow(/Unknown option/);
  });

  it('routes `artifacts --help` to its own usage', async () => {
    const chunks = [];
    const original = process.stdout.write;
    process.stdout.write = (chunk) => {
      chunks.push(chunk);
      return true;
    };

    try {
      expect(await main(['artifacts', '--help'])).toBe(0);
    } finally {
      process.stdout.write = original;
    }

    expect(chunks.join('')).toContain('ds-resync artifacts — sync');
  });
});

describe('the binary entry point', () => {
  function runCli(entry) {
    return execFileSync(process.execPath, [entry, '--help'], { encoding: 'utf8' });
  }

  it('runs when invoked directly', () => {
    expect(runCli(CLI_PATH)).toContain('ds-resync — bring');
  });

  it('runs when invoked through a bin symlink', () => {
    // npm installs a bin as a symlink and Node reports that path in argv[1],
    // so a filename match on "cli.mjs" fails and the CLI silently does nothing.
    const link = join(mkdtempSync(join(tmpdir(), 'ds-bin-')), 'ds-resync');
    symlinkSync(CLI_PATH, link);
    expect(runCli(link)).toContain('ds-resync — bring');
  });
});
