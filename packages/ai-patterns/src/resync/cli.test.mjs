import { describe, expect, it } from 'vitest';
import { formatReport, parseArgs } from './cli.mjs';

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
        latestVersion: '2.0.0',
        jump: 'major',
        outdated: true,
        entries: [{ version: '2.0.0', body: '### Major Changes\n\n- abc: Removed ghost.' }],
      },
      {
        name: '@elirobinson/tokens',
        declaredRange: '^0.2.0',
        installedVersion: '0.2.0',
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
