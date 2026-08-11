import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkDrift,
  formatArtifactsReport,
  formatDriftWarning,
  planWrite,
  readArtifactSet,
  readRecord,
  RECORD_PATH,
  recordFrom,
  runArtifacts,
  sha256,
} from './artifacts.mjs';

const TARGET_ROOT = '.claude/skills';

function file(path, hash) {
  return { path, hash };
}

/** A staged artifact tree, as `scripts/build-artifacts.mjs` would leave it. */
function makeArtifacts(contents, stamp = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-artifacts-'));

  const files = Object.entries(contents).map(([path, body]) => {
    const destination = join(dir, 'skills', path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, body);
    return { path, hash: sha256(Buffer.from(body)) };
  });

  writeFileSync(
    join(dir, 'artifacts.json'),
    JSON.stringify({
      aiPatternsVersion: '0.5.0',
      reactVersion: '1.2.0',
      tokensVersion: '0.3.0',
      targetRoot: TARGET_ROOT,
      files,
      ...stamp,
    }),
  );

  return dir;
}

function makeRepo({ react } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-consumer-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app' }));

  if (react) {
    const packageDir = join(dir, 'node_modules', '@elirobinson', 'react');
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      join(packageDir, 'package.json'),
      JSON.stringify({ name: '@elirobinson/react', version: react }),
    );
  }

  return dir;
}

function read(dir, path) {
  return readFileSync(join(dir, path), 'utf8');
}

describe('planWrite', () => {
  const files = [file('brand/SKILL.md', 'hash-new')];

  it('creates a file that is not there', () => {
    const plan = planWrite({
      files,
      targetRoot: TARGET_ROOT,
      recorded: {},
      onDisk: { '.claude/skills/brand/SKILL.md': null },
    });
    expect(plan[0]).toMatchObject({ target: '.claude/skills/brand/SKILL.md', status: 'created' });
  });

  it('leaves a file that already matches the shipped copy alone', () => {
    const plan = planWrite({
      files,
      targetRoot: TARGET_ROOT,
      recorded: {},
      onDisk: { '.claude/skills/brand/SKILL.md': 'hash-new' },
    });
    expect(plan[0].status).toBe('unchanged');
  });

  it('updates a file that still matches what this command last wrote', () => {
    const plan = planWrite({
      files,
      targetRoot: TARGET_ROOT,
      recorded: { '.claude/skills/brand/SKILL.md': 'hash-old' },
      onDisk: { '.claude/skills/brand/SKILL.md': 'hash-old' },
    });
    expect(plan[0].status).toBe('updated');
  });

  it('skips a file the user has edited since it was written, and says why', () => {
    const plan = planWrite({
      files,
      targetRoot: TARGET_ROOT,
      recorded: { '.claude/skills/brand/SKILL.md': 'hash-old' },
      onDisk: { '.claude/skills/brand/SKILL.md': 'hash-edited-by-user' },
    });
    expect(plan[0]).toMatchObject({
      status: 'modified',
      reason: 'edited since it was written',
    });
  });

  it('treats an untracked file as edited — the conservative reading is the safe one', () => {
    const plan = planWrite({
      files,
      targetRoot: TARGET_ROOT,
      recorded: {},
      onDisk: { '.claude/skills/brand/SKILL.md': 'something-else' },
    });
    expect(plan[0]).toMatchObject({ status: 'modified', reason: 'not written by this command' });
  });

  it('overwrites an edited file only when --force is passed', () => {
    const plan = planWrite({
      files,
      targetRoot: TARGET_ROOT,
      recorded: {},
      onDisk: { '.claude/skills/brand/SKILL.md': 'something-else' },
      force: true,
    });
    expect(plan[0].status).toBe('overwritten');
  });
});

describe('recordFrom', () => {
  it('records what is now on disk, and not what was skipped', () => {
    const record = recordFrom(
      [
        { target: 'a', hash: 'h1', status: 'created' },
        { target: 'b', hash: 'h2', status: 'unchanged' },
        { target: 'c', hash: 'h3', status: 'modified' },
      ],
      { c: 'previous' },
    );
    expect(record).toEqual({ a: 'h1', b: 'h2', c: 'previous' });
  });
});

describe('checkDrift', () => {
  const stamp = { reactVersion: '1.2.0' };

  it('reports a mismatch between the snapshot and the installed react', () => {
    expect(checkDrift({ stamp, installed: '1.4.0' })).toEqual({
      expected: '1.2.0',
      installed: '1.4.0',
    });
  });

  it('is quiet when the versions agree', () => {
    expect(checkDrift({ stamp, installed: '1.2.0' })).toBeNull();
  });

  it('is quiet when react is not installed — there is nothing to be wrong about', () => {
    expect(checkDrift({ stamp, installed: null })).toBeNull();
  });
});

describe('formatDriftWarning', () => {
  const text = formatDriftWarning({ expected: '1.2.0', installed: '1.4.0' });

  it('names both versions and both remedies', () => {
    expect(text).toContain('STALE SNAPSHOT');
    expect(text).toContain('1.2.0');
    expect(text).toContain('1.4.0');
    expect(text).toContain('ds-resync artifacts --write');
  });
});

describe('formatArtifactsReport', () => {
  const stamp = { aiPatternsVersion: '0.5.0', reactVersion: '1.2.0', tokensVersion: '0.3.0' };

  it('leads with the drift warning when there is one', () => {
    const text = formatArtifactsReport({
      stamp,
      wrote: false,
      drift: { expected: '1.2.0', installed: '1.4.0' },
      plan: [],
    });
    expect(text.startsWith('!!  STALE SNAPSHOT')).toBe(true);
  });

  it('names every skipped file so the user can reconcile it', () => {
    const text = formatArtifactsReport({
      stamp,
      wrote: true,
      drift: null,
      plan: [
        {
          target: '.claude/skills/a/SKILL.md',
          status: 'modified',
          reason: 'edited since it was written',
        },
      ],
    });
    expect(text).toContain('Left untouched — locally edited (1)');
    expect(text).toContain('.claude/skills/a/SKILL.md  (edited since it was written)');
    expect(text).toContain('--force');
  });

  it('offers --write on a read-only run that would change something', () => {
    const text = formatArtifactsReport({
      stamp,
      wrote: false,
      drift: null,
      plan: [{ target: 'a', status: 'created' }],
    });
    expect(text).toContain('Would create 1');
    expect(text).toContain('Run `ds-resync artifacts --write` to apply.');
  });
});

describe('readArtifactSet', () => {
  it('explains what to do when the package shipped without artifacts', () => {
    expect(() => readArtifactSet(mkdtempSync(join(tmpdir(), 'ds-empty-')))).toThrow(
      /packed without them/,
    );
  });
});

describe('runArtifacts end to end', () => {
  it('reports without writing anything by default', () => {
    const artifacts = makeArtifacts({ 'brand/SKILL.md': 'v1' });
    const repo = makeRepo();

    const result = runArtifacts({ cwd: repo, dir: artifacts });

    expect(result.plan.map((entry) => entry.status)).toEqual(['created']);
    expect(existsSync(join(repo, '.claude/skills/brand/SKILL.md'))).toBe(false);
    expect(existsSync(join(repo, RECORD_PATH))).toBe(false);
  });

  it('writes the tree and records what it wrote', () => {
    const artifacts = makeArtifacts({ 'brand/SKILL.md': 'v1', 'ref/llms.txt': 'index' });
    const repo = makeRepo();

    runArtifacts({ cwd: repo, dir: artifacts, write: true });

    expect(read(repo, '.claude/skills/brand/SKILL.md')).toBe('v1');
    expect(read(repo, '.claude/skills/ref/llms.txt')).toBe('index');

    const record = readRecord(repo);
    expect(record.reactVersion).toBe('1.2.0');
    expect(record.files['.claude/skills/brand/SKILL.md']).toBe(sha256(Buffer.from('v1')));
  });

  it('updates an untouched file on the next release, and skips one the user edited', () => {
    const repo = makeRepo();
    runArtifacts({
      cwd: repo,
      dir: makeArtifacts({ 'brand/SKILL.md': 'v1', 'ref/llms.txt': 'index v1' }),
      write: true,
    });

    // The user edits one of the two files, then a new version ships.
    writeFileSync(join(repo, '.claude/skills/brand/SKILL.md'), 'v1 plus my own notes');

    const result = runArtifacts({
      cwd: repo,
      dir: makeArtifacts({ 'brand/SKILL.md': 'v2', 'ref/llms.txt': 'index v2' }),
      write: true,
    });

    const byTarget = Object.fromEntries(result.plan.map((entry) => [entry.target, entry.status]));
    expect(byTarget['.claude/skills/ref/llms.txt']).toBe('updated');
    expect(byTarget['.claude/skills/brand/SKILL.md']).toBe('modified');

    expect(read(repo, '.claude/skills/ref/llms.txt')).toBe('index v2');
    expect(read(repo, '.claude/skills/brand/SKILL.md')).toBe('v1 plus my own notes');
    expect(formatArtifactsReport(result)).toContain('.claude/skills/brand/SKILL.md');
  });

  it('leaves the record for a skipped file pointing at what it last wrote', () => {
    const repo = makeRepo();
    runArtifacts({ cwd: repo, dir: makeArtifacts({ 'brand/SKILL.md': 'v1' }), write: true });
    writeFileSync(join(repo, '.claude/skills/brand/SKILL.md'), 'my edit');
    runArtifacts({ cwd: repo, dir: makeArtifacts({ 'brand/SKILL.md': 'v2' }), write: true });

    // Still v1's hash: the next run must be able to tell this file is edited.
    expect(readRecord(repo).files['.claude/skills/brand/SKILL.md']).toBe(sha256(Buffer.from('v1')));
  });

  it('takes the shipped copy when --force is passed', () => {
    const repo = makeRepo();
    runArtifacts({ cwd: repo, dir: makeArtifacts({ 'brand/SKILL.md': 'v1' }), write: true });
    writeFileSync(join(repo, '.claude/skills/brand/SKILL.md'), 'my edit');

    runArtifacts({
      cwd: repo,
      dir: makeArtifacts({ 'brand/SKILL.md': 'v2' }),
      write: true,
      force: true,
    });

    expect(read(repo, '.claude/skills/brand/SKILL.md')).toBe('v2');
  });

  it('is idempotent — a second identical run changes nothing', () => {
    const artifacts = makeArtifacts({ 'brand/SKILL.md': 'v1' });
    const repo = makeRepo();

    runArtifacts({ cwd: repo, dir: artifacts, write: true });
    const second = runArtifacts({ cwd: repo, dir: artifacts, write: true });

    expect(second.plan.map((entry) => entry.status)).toEqual(['unchanged']);
    expect(formatArtifactsReport(second)).toContain('Everything was already current.');
  });

  it('warns when the installed react is not the one the snapshot describes', () => {
    const result = runArtifacts({
      cwd: makeRepo({ react: '1.4.0' }),
      dir: makeArtifacts({ 'brand/SKILL.md': 'v1' }),
    });

    expect(result.drift).toEqual({ expected: '1.2.0', installed: '1.4.0' });
    expect(formatArtifactsReport(result)).toContain('STALE SNAPSHOT');
  });

  it('does not warn when the installed react matches the stamp', () => {
    const result = runArtifacts({
      cwd: makeRepo({ react: '1.2.0' }),
      dir: makeArtifacts({ 'brand/SKILL.md': 'v1' }),
    });

    expect(result.drift).toBeNull();
    expect(formatArtifactsReport(result)).not.toContain('STALE SNAPSHOT');
  });

  it('treats a corrupt record as "nothing written yet" rather than throwing', () => {
    const repo = makeRepo();
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(join(repo, RECORD_PATH), 'not json {');

    expect(readRecord(repo).files).toEqual({});
    expect(() => runArtifacts({ cwd: repo, dir: makeArtifacts({ 'a.md': 'x' }) })).not.toThrow();
  });
});
