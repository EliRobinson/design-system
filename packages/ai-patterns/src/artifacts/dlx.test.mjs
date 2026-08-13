// This package declares two bins, so `pnpm dlx <pkg> <bin>` cannot work: pnpm
// parses the trailing word as an argument to an implied binary, finds two
// candidates, and aborts with ERR_PNPM_DLX_MULTIPLE_BINS. That abort happens
// *before* the binary is spawned, so no amount of runtime handling inside
// ds-resync can catch it — the fix has to be that the broken string is never
// written down. `DLX` is the one place the invocation prefix lives, and these
// tests are what protect the markdown that cannot import it.
//
// The command tests run pnpm against this package's own directory rather than
// the published tarball. That exercises the identical bin-resolution path (it
// reads the same `bin` map) without needing registry auth or a network, and it
// is discriminating: the bare form still fails here exactly as it does against
// the registry, which the last test in this file asserts.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DLX, RESYNC_COMMAND } from './llms.mjs';

const PACKAGE_DIR = resolve(import.meta.dirname, '..', '..');
const PACKAGE_JSON = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf-8'));
const PACKAGE_NAME = PACKAGE_JSON.name;
const BINS = Object.keys(PACKAGE_JSON.bin);

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: PACKAGE_DIR,
  encoding: 'utf-8',
}).trim();

/* Assembled from parts so the broken literal never appears in this file — the
   guard below scans every tracked file, including this one. */
const BARE_PREFIX = ['pnpm', 'dlx', PACKAGE_NAME].join(' ');

describe('DLX', () => {
  it('names the package explicitly, which is what makes a multi-bin dlx resolvable', () => {
    expect(DLX).toBe(`pnpm --package=${PACKAGE_NAME} dlx`);
  });

  it('declares more than one bin, which is why the bare form cannot work', () => {
    expect(BINS.length).toBeGreaterThan(1);
  });

  it('is the prefix RESYNC_COMMAND is built from', () => {
    expect(RESYNC_COMMAND).toBe(`${DLX} ds-resync artifacts --write`);
  });
});

describe('no source, prompt, template or doc writes the bare form', () => {
  /* Changelogs and the dated planning documents under docs/superpowers record
     what was written at the time. Rewriting them would falsify history. */
  const EXEMPT = [/(^|\/)CHANGELOG\.md$/, /^docs\/superpowers\//];

  const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean)
    .filter((file) => !EXEMPT.some((pattern) => pattern.test(file)));

  it('finds the bare prefix nowhere outside the exempt history', () => {
    const offenders = [];

    for (const file of trackedFiles) {
      let contents;
      try {
        contents = readFileSync(join(REPO_ROOT, file), 'utf-8');
      } catch {
        continue; // unreadable or binary — nothing to match
      }
      if (!contents.includes(BARE_PREFIX)) continue;

      contents.split('\n').forEach((line, index) => {
        if (line.includes(BARE_PREFIX)) offenders.push(`${file}:${index + 1}  ${line.trim()}`);
      });
    }

    expect(
      offenders,
      `\`${BARE_PREFIX}\` cannot run: ${PACKAGE_NAME} ships ${BINS.length} bins ` +
        `(${BINS.join(', ')}), so pnpm aborts with ERR_PNPM_DLX_MULTIPLE_BINS before the ` +
        `binary starts. Write \`${DLX} <bin>\` instead — in .mjs, import DLX from ` +
        `./artifacts/llms.mjs rather than retyping it:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

describe('the documented invocation actually runs', () => {
  let scratch;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'ds-dlx-'));
    // ds-resync reports on the packages a repo has installed, so it needs a
    // project to point at; without one it exits non-zero on its own terms and
    // would mask what these tests are actually measuring.
    writeFileSync(
      join(scratch, 'package.json'),
      `${JSON.stringify({ name: 'dlx-scratch', version: '1.0.0', private: true }, null, 2)}\n`,
    );
  });

  afterAll(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  });

  /* `DLX` names the package by its registry name. Swapping that for this
     working copy keeps the invocation's shape under test — if DLX regressed to
     the bare form, so would this — while resolving offline. */
  const invocation = (suffix) => `${DLX.replace(PACKAGE_NAME, PACKAGE_DIR)} ${suffix}`;

  const run = (command) =>
    spawnSync(command, { cwd: scratch, shell: true, encoding: 'utf-8', timeout: 180_000 });

  it.each(BINS)(
    'resolves the %s bin and exits zero',
    (bin) => {
      const args = bin === 'ds-resync' ? '--json' : '--help';
      const result = run(invocation(`${bin} ${args}`));

      expect(result.stderr).not.toContain('ERR_PNPM_DLX_MULTIPLE_BINS');
      expect({ status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
    },
    180_000,
  );

  // The test above passes just as well against a single-bin package, so on its
  // own it does not prove the `--package=` form is what is doing the work.
  // This one fails if the bug it was written for ever stops being a bug.
  it('still fails on the bare form, which is why the guard above exists', () => {
    const result = run(`${BARE_PREFIX.replace(PACKAGE_NAME, PACKAGE_DIR)} ds-resync --json`);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ERR_PNPM_DLX_MULTIPLE_BINS');
  }, 180_000);
});
