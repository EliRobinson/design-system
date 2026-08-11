import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatReport, main } from './cli.mjs';
import { TARGETS } from './targets.mjs';

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), 'cli.mjs');

async function captureStdout(argv) {
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
  it('routes `artifacts --help` to its own usage', async () => {
    const { code, text } = await captureStdout(['artifacts', '--help']);
    expect(code).toBe(0);
    expect(text).toContain('ds-resync artifacts — sync');
  });
});

// Byte-for-byte the help text as it stood when the options section was still
// hand-written, pinned before it was generated from the flag table. Drift here
// is a user-visible change to the CLI's documented surface, so it should be a
// deliberate edit to these strings, never a side effect of touching a renderer.
const EXPECTED_USAGE = `ds-resync — bring this repo's @elirobinson packages up to date

Usage: ds-resync [options]
       ds-resync artifacts [options]

Commands:
  (default)             Report and optionally apply dependency upgrades
  artifacts             Sync the design system's agent skills into this repo

Options:
  --write               Apply the upgrades and install (default is read-only)
  --only <names>        Restrict to these packages (comma-separated, scope optional)
  --target <spec>       How far to jump: latest | minor | patch
                        Global ("minor") or per-package ("react=minor,tokens=latest")
  --interactive, -i     Choose per package, then apply (implies --write)
  --json                Emit the report as JSON
  --cwd <dir>           Target a directory other than the current one
  --fail-on-outdated    Exit 2 when anything is behind (for CI)
  -h, --help            Show this message

Run \`ds-resync artifacts --help\` for that command's options.
`;

const EXPECTED_ARTIFACTS_USAGE = `ds-resync artifacts — sync the design system's agent skills into this repo

Writes the brand skill, a version-stamped component reference (llms.txt /
llms-full.txt), and the re-sync instructions into .claude/skills/. Files you have
edited since they were written are left alone and listed in the report.

Usage: ds-resync artifacts [options]

Options:
  --write               Apply the changes (default is read-only)
  --force               Overwrite files you have edited locally
  --json                Emit the plan as JSON
  --cwd <dir>           Target a directory other than the current one
  --fail-on-drift       Exit 2 when the snapshot and the installed
                        @elirobinson/react disagree (for CI)
  -h, --help            Show this message
`;

describe('the help text', () => {
  it('prints the default run’s usage unchanged, down to the column alignment', async () => {
    const { code, text } = await captureStdout(['--help']);
    expect(code).toBe(0);
    expect(text).toBe(EXPECTED_USAGE);
  });

  it('prints the artifacts usage unchanged, down to the column alignment', async () => {
    const { code, text } = await captureStdout(['artifacts', '--help']);
    expect(code).toBe(0);
    expect(text).toBe(EXPECTED_ARTIFACTS_USAGE);
  });

  it('spells out the real target vocabulary rather than a placeholder', async () => {
    // The line is interpolated from TARGETS, so a renderer that lost the
    // interpolation would still look plausible against a frozen string. Tying
    // the assertion back to TARGETS also means adding a target fails here
    // rather than leaving the pinned text quietly stale.
    const { text } = await captureStdout(['--help']);
    expect(text).toContain(`How far to jump: ${TARGETS.join(' | ')}`);
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
