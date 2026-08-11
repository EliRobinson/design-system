import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseArgs, parseArtifactsArgs, renderOptions } from './args.mjs';

describe('renderOptions', () => {
  const DESCRIPTION_COLUMN = 24;

  it('lists a flag’s spellings in the order the table declares them', () => {
    // The two orders in the help text disagree on purpose — `-h, --help` but
    // `--interactive, -i` — so the array order has to survive rendering.
    expect(
      renderOptions([{ names: ['-h', '--help'], description: 'Show this message' }]),
    ).toContain('-h, --help');
    expect(
      renderOptions([{ names: ['--interactive', '-i'], description: 'Choose per package' }]),
    ).toContain('--interactive, -i');
  });

  it('writes a value flag’s placeholder after its spellings', () => {
    const line = renderOptions([
      { names: ['--cwd'], placeholder: '<dir>', description: 'Target a directory' },
    ]);
    expect(line.startsWith('  --cwd <dir>')).toBe(true);
  });

  it('starts every description at the same column, whatever the flag is called', () => {
    const rendered = renderOptions([
      { names: ['--write'], description: 'Apply the upgrades' },
      { names: ['--fail-on-outdated'], description: 'Exit 2 when anything is behind' },
    ]);

    const [first, second] = rendered.split('\n');
    expect(first.indexOf('Apply the upgrades')).toBe(DESCRIPTION_COLUMN);
    expect(second.indexOf('Exit 2 when anything is behind')).toBe(DESCRIPTION_COLUMN);
  });

  it('hangs a wrapped description under the first line, not under the flag', () => {
    const rendered = renderOptions([
      {
        names: ['--fail-on-drift'],
        description: 'Exit 2 when the snapshot and the installed\n@elirobinson/react disagree',
      },
    ]);

    const [first, second] = rendered.split('\n');
    expect(first.indexOf('Exit 2 when the snapshot')).toBe(DESCRIPTION_COLUMN);
    expect(second.indexOf('@elirobinson/react disagree')).toBe(DESCRIPTION_COLUMN);
  });

  it('keeps a gap when a flag is too long for the column instead of running the two together', () => {
    const rendered = renderOptions([
      {
        names: ['--a-flag-whose-name-is-far-too-long'],
        placeholder: '<value>',
        description: 'Still readable',
      },
    ]);

    expect(rendered).toBe('  --a-flag-whose-name-is-far-too-long <value> Still readable');
  });
});

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

describe('flags shared between the two commands', () => {
  it('reads --cwd=<dir> identically to --cwd <dir>, on both commands', () => {
    // One parser serves both commands, so the two spellings and the two
    // commands have to agree — the prefix form used to be implemented twice.
    const spaced = parseArgs(['--cwd', '/tmp/app']).cwd;
    expect(parseArgs(['--cwd=/tmp/app']).cwd).toBe(spaced);
    expect(parseArtifactsArgs(['--cwd', '/tmp/app']).cwd).toBe(spaced);
    expect(parseArtifactsArgs(['--cwd=/tmp/app']).cwd).toBe(spaced);
  });

  it('resolves a relative --cwd against the process cwd in either form', () => {
    expect(parseArgs(['--cwd=sub']).cwd).toBe(resolve('sub'));
    expect(parseArtifactsArgs(['--cwd=sub']).cwd).toBe(resolve('sub'));
  });

  it('does not accept a value on a boolean flag', () => {
    expect(() => parseArgs(['--write=yes'])).toThrow(/Unknown option: --write=yes/);
    expect(() => parseArtifactsArgs(['--force=yes'])).toThrow(/Unknown option: --force=yes/);
  });
});

describe('flags belonging to only one command', () => {
  it('rejects an artifacts-only flag on the default run', () => {
    expect(() => parseArgs(['--force'])).toThrow(/Unknown option: --force/);
    expect(() => parseArgs(['--fail-on-drift'])).toThrow(/Unknown option: --fail-on-drift/);
  });

  it('rejects a default-run-only flag on artifacts, in both forms', () => {
    expect(() => parseArtifactsArgs(['--only', 'react'])).toThrow(/Unknown option: --only/);
    expect(() => parseArtifactsArgs(['--only=react'])).toThrow(/Unknown option: --only=react/);
    expect(() => parseArtifactsArgs(['--interactive'])).toThrow(/Unknown option: --interactive/);
    expect(() => parseArtifactsArgs(['-i'])).toThrow(/Unknown option: -i/);
    expect(() => parseArtifactsArgs(['--fail-on-outdated'])).toThrow(
      /Unknown option: --fail-on-outdated/,
    );
  });
});

describe('parseArtifactsArgs', () => {
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
});
