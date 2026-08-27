import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEFAULT_PACK_CANDIDATES, resolveVoicePack, STARTER_PACK_PATH } from './resolve.mjs';
import { validatePack } from './schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..', '..');
const scratch = () => mkdtempSync(join(tmpdir(), 'voice-'));

const valid = {
  id: 'cabin',
  label: 'Cabin',
  fullName: 'Cabin Whisperer',
  person: { summary: 's', guidance: 'g', anchors: { asPerson: 'p', asCompany: 'c' } },
  tone: [{ name: 'Warm', gloss: 'g' }],
  casing: ['c'],
  words: { use: ['stay'], avoid: ['synergy'] },
  emoji: { guidance: 'g', allowed: [] },
  samples: ['a'],
  taglines: ['t'],
};

describe('resolveVoicePack', () => {
  it('falls back to the shipped pack, labelled as the default', () => {
    const result = resolveVoicePack({ cwd: scratch() });
    expect(result.source).toBe('default');
    expect(result.pack.id).toBe('miltinson');
  });

  it('prefers a consumer pack at the repo root', () => {
    const cwd = scratch();
    writeFileSync(join(cwd, 'voice.json'), JSON.stringify(valid));
    const result = resolveVoicePack({ cwd });
    expect(result.source).toBe('consumer');
    expect(result.pack.id).toBe('cabin');
  });

  /* The defect this whole design closes is getting someone else's voice silently.
     Falling back on a malformed pack would reintroduce it one layer down. */
  it('throws on a malformed consumer pack rather than falling back', () => {
    const cwd = scratch();
    writeFileSync(join(cwd, 'voice.json'), JSON.stringify({ id: 'broken' }));
    expect(() => resolveVoicePack({ cwd })).toThrow(/voice\.json/);
  });

  it('names the field that failed, so the fix is obvious from the message alone', () => {
    const cwd = scratch();
    writeFileSync(join(cwd, 'voice.json'), JSON.stringify({ ...valid, fullName: undefined }));
    expect(() => resolveVoicePack({ cwd })).toThrow(/fullName/);
  });

  it('throws on unparseable JSON rather than falling back', () => {
    const cwd = scratch();
    writeFileSync(join(cwd, 'voice.json'), '{ not json');
    expect(() => resolveVoicePack({ cwd })).toThrow(/voice\.json/);
  });
});

/* The consumer case this repo cannot reproduce by accident. `design-system-docs/` is not in
   package.json's `files`, so a consumer only ever has the copy under dist/. A source-tree-first
   resolution passes every other test in this file and throws for every consumer, so the
   default's location is asserted rather than assumed. */
describe('where the default comes from', () => {
  it('prefers a candidate the published package actually carries', () => {
    const [preferred, fallback] = DEFAULT_PACK_CANDIDATES;
    const { files } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

    /* Inside the package, and under a directory `files` publishes. Both halves matter:
       a path inside the package but under an unpublished directory ships nothing. */
    const inside = relative(packageRoot, preferred);
    expect(inside.startsWith('..')).toBe(false);
    expect(files).toContain(inside.split(/[\\/]/)[0]);

    /* And the fallback is the one that walks out of the package — which is why it
       cannot be the preferred one. */
    expect(relative(packageRoot, fallback).startsWith('..')).toBe(true);
  });

  it('defaults to the packed copy, which is the only one a consumer receives', () => {
    expect(
      existsSync(DEFAULT_PACK_CANDIDATES[0]),
      'the packed copy is a build output — run `pnpm nx build ai-patterns` before this suite',
    ).toBe(true);

    const { path } = resolveVoicePack({ cwd: scratch() });
    expect(path).toContain(join('dist', 'artifacts', 'skills', 'miltinson-design'));
    expect(path).not.toContain('design-system-docs');
  });
});

/* The starter restates the schema with system defaults and no brand's values — the rule
   `docs/agents/product-token-layer.md:149` states for tokens. A starter carrying
   Miltinson's answers would hand every consumer this brand's voice under their own id,
   which is the failure one layer up from the one the resolver closes. */
describe('the starter pack', () => {
  const starter = JSON.parse(readFileSync(STARTER_PACK_PATH, 'utf8'));

  it('is a valid pack, so `ds init --voice` cannot scaffold something that throws', () => {
    expect(() => validatePack(starter)).not.toThrow();
  });

  it('carries no brand of ours anywhere in it', () => {
    expect(JSON.stringify(starter)).not.toMatch(/miltinson/i);
  });
});
