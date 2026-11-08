/* `ds-resync artifacts --write` against the consumer's INSTALLED react and
 * tokens (#257). These run the real staged tree in dist/artifacts — the one
 * the tarball ships — so they prove the files a consumer receives, not a
 * fixture shaped like them.
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  artifactsDir,
  formatArtifactsReport,
  readArtifactSet,
  runArtifacts,
} from './artifacts.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRequire = createRequire(join(packageDir, 'package.json'));
const tokensSrc = dirname(workspaceRequire.resolve('@elirobinson/tokens/tokens.css'));
const tokensRoot = join(tokensSrc, '..');
const reactManifest = workspaceRequire.resolve('@elirobinson/react/manifest');
const reactRoot = join(dirname(reactManifest), '..');

const BUNDLED_CHART = 'oklch(62% 0.13 10)';
const INSTALLED_CHART = 'oklch(55% 0.2 140)';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** A consumer repo with @elirobinson/tokens and @elirobinson/react installed
 *  at `version`, laid out the way a package manager leaves them. */
function makeConsumer({
  version = '99.0.0',
  tokens = true,
  react = true,
  nested = false,
  chart = INSTALLED_CHART,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ds-installed-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'app' }));

  if (tokens) {
    const dir = join(root, 'node_modules', '@elirobinson', 'tokens');
    cpSync(join(tokensSrc), join(dir, 'src'), { recursive: true, dereference: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ ...readJson(join(tokensRoot, 'package.json')), version }),
    );
    const palettes = join(dir, 'src', 'palettes.css');
    const css = readFileSync(palettes, 'utf8');
    expect(css).toContain(`--chart-1: ${BUNDLED_CHART}`);
    writeFileSync(palettes, css.replace(`--chart-1: ${BUNDLED_CHART}`, `--chart-1: ${chart}`));
  }

  if (react) {
    const dir = join(root, 'node_modules', '@elirobinson', 'react');
    mkdirSync(join(dir, 'dist'), { recursive: true });
    cpSync(reactManifest, join(dir, 'dist', 'manifest.json'));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ ...readJson(join(reactRoot, 'package.json')), version }),
    );
  }

  if (!nested) return { root, cwd: root };

  // A workspace member with no node_modules of its own: Node walks up.
  const cwd = join(root, 'apps', 'web');
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'web' }));
  return { root, cwd };
}

function written(cwd, path) {
  return readFileSync(join(cwd, '.claude/skills', path), 'utf8');
}

describe('artifacts --write from the installed packages', () => {
  it('writes the installed token values, not the bundled snapshot', async () => {
    const { cwd } = makeConsumer();

    const result = await runArtifacts({ cwd, write: true });

    expect(written(cwd, 'miltinson-design/palettes.css')).toContain(
      `--chart-1: ${INSTALLED_CHART}`,
    );
    expect(written(cwd, 'miltinson-design/palettes.css')).not.toContain(
      `--chart-1: ${BUNDLED_CHART}`,
    );
    expect(written(cwd, 'design-system-reference/llms-full.txt')).toContain(
      `\`--chart-1: ${INSTALLED_CHART}\``,
    );
    expect(written(cwd, 'design-system-reference/SKILL.md')).toContain(
      '@elirobinson/react@99.0.0 and @elirobinson/tokens@99.0.0',
    );

    expect(result.source).toBe('installed');
    expect(result.drift).toBeNull();
    const report = formatArtifactsReport(result);
    expect(report).not.toContain('STALE SNAPSHOT');
    expect(report).toContain('generated from the installed @elirobinson/react@99.0.0');
  });

  it('records the installed versions, and a second run is current', async () => {
    const { cwd } = makeConsumer();
    await runArtifacts({ cwd, write: true });

    const record = readJson(join(cwd, '.claude/ds-artifacts.json'));
    expect(record.reactVersion).toBe('99.0.0');
    expect(record.tokensVersion).toBe('99.0.0');

    const second = await runArtifacts({ cwd, write: true });
    expect(second.plan.every((entry) => entry.status === 'unchanged')).toBe(true);
  });

  it('is no longer current once the installed tokens change', async () => {
    const { root, cwd } = makeConsumer();
    await runArtifacts({ cwd, write: true });

    const palettes = join(root, 'node_modules/@elirobinson/tokens/src/palettes.css');
    writeFileSync(
      palettes,
      readFileSync(palettes, 'utf8').replace(INSTALLED_CHART, 'oklch(40% 0.1 200)'),
    );

    const next = await runArtifacts({ cwd });
    const byPath = Object.fromEntries(next.plan.map((entry) => [entry.path, entry.status]));
    expect(byPath['miltinson-design/palettes.css']).toBe('updated');
    expect(byPath['design-system-reference/llms-full.txt']).toBe('updated');
  });

  it('resolves the packages the way Node does, from a nested workspace member', async () => {
    const { cwd } = makeConsumer({ nested: true });

    const result = await runArtifacts({ cwd, write: true });

    expect(result.source).toBe('installed');
    expect(written(cwd, 'miltinson-design/palettes.css')).toContain(INSTALLED_CHART);
  });

  it('falls back to the bundled snapshot, and says so, when tokens is not installed', async () => {
    const { cwd } = makeConsumer({ tokens: false });

    const result = await runArtifacts({ cwd, write: true });

    expect(result.source).toBe('bundled');
    expect(result.fallbackReason).toContain('@elirobinson/tokens is not installed');
    expect(written(cwd, 'miltinson-design/palettes.css')).toContain(BUNDLED_CHART);
    const report = formatArtifactsReport(result);
    expect(report).toContain('bundled snapshot');
    expect(report).toContain('@elirobinson/tokens is not installed');
  });

  it('falls back to the bundled snapshot when react is not installed', async () => {
    const { cwd } = makeConsumer({ react: false });

    const result = await runArtifacts({ cwd });

    expect(result.source).toBe('bundled');
    expect(result.fallbackReason).toContain('@elirobinson/react is not installed');
  });

  it('produces the bundled bytes when the installed packages are the ones it was packed from', async () => {
    const staged = readArtifactSet(artifactsDir());
    const { cwd } = makeConsumer({
      version: staged.stamp.reactVersion,
      chart: BUNDLED_CHART,
    });
    // Both stamps must match for the version lines to agree.
    expect(staged.stamp.tokensVersion).toBeDefined();
    const tokensPackage = join(cwd, 'node_modules/@elirobinson/tokens/package.json');
    writeFileSync(
      tokensPackage,
      JSON.stringify({ ...readJson(tokensPackage), version: staged.stamp.tokensVersion }),
    );

    const result = await runArtifacts({ cwd });

    expect(result.source).toBe('installed');
    expect(result.plan.filter((entry) => entry.status !== 'created')).toEqual([]);
    const hashes = Object.fromEntries(staged.files.map((entry) => [entry.path, entry.hash]));
    for (const entry of result.plan)
      expect([entry.path, entry.hash]).toEqual([entry.path, hashes[entry.path]]);
  });

  it('falls back, with a reason, when an installed package.json is corrupt', async () => {
    const { root, cwd } = makeConsumer();
    writeFileSync(join(root, 'node_modules/@elirobinson/react/package.json'), '{bad');

    const result = await runArtifacts({ cwd });

    expect(result.source).toBe('bundled');
    expect(result.fallbackReason).toContain('could not be read');
  });

  it('falls back when the installed tokens is too old to export its parser', async () => {
    const { root, cwd } = makeConsumer();
    const manifestPath = join(root, 'node_modules/@elirobinson/tokens/package.json');
    const manifest = readJson(manifestPath);
    delete manifest.exports['./parse-tokens-css'];
    writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = await runArtifacts({ cwd });

    expect(result.source).toBe('bundled');
    expect(result.fallbackReason).toContain('parse-tokens-css');
  });

  it('falls back when the installed stylesheets declare no tokens', async () => {
    const { root, cwd } = makeConsumer();
    for (const name of ['palettes.css', 'tokens.css']) {
      writeFileSync(join(root, 'node_modules/@elirobinson/tokens/src', name), '');
    }

    const result = await runArtifacts({ cwd });

    expect(result.source).toBe('bundled');
    expect(result.fallbackReason).toContain('No tokens parsed');
  });

  it('reports the repo as out of date when the installed packages moved since --write', async () => {
    const { root, cwd } = makeConsumer();
    await runArtifacts({ cwd, write: true });
    const manifestPath = join(root, 'node_modules/@elirobinson/react/package.json');
    writeFileSync(manifestPath, JSON.stringify({ ...readJson(manifestPath), version: '99.1.0' }));

    const dryRun = await runArtifacts({ cwd });

    expect(dryRun.drift).toEqual({
      kind: 'record',
      packages: [{ name: '@elirobinson/react', written: '99.0.0', now: '99.1.0' }],
    });
    expect(formatArtifactsReport(dryRun)).toContain('OUT OF DATE');

    const afterWrite = await runArtifacts({ cwd, write: true });
    expect(afterWrite.drift).toBeNull();
    expect((await runArtifacts({ cwd })).drift).toBeNull();
  });

  it('writes a font that a newer installed tokens added and references', async () => {
    const { root, cwd } = makeConsumer();
    const tokensSrc = join(root, 'node_modules/@elirobinson/tokens/src');
    writeFileSync(join(tokensSrc, 'fonts', 'brand-new.woff2'), 'font bytes');
    writeFileSync(
      join(tokensSrc, 'fonts.css'),
      `${readFileSync(join(tokensSrc, 'fonts.css'), 'utf8')}\n@font-face { font-family: 'New'; src: url('./fonts/brand-new.woff2') format('woff2'); }\n`,
    );

    const result = await runArtifacts({ cwd, write: true });

    expect(written(cwd, 'miltinson-design/fonts/brand-new.woff2')).toBe('font bytes');
    expect(result.keptBundled).toEqual([]);
  });

  it('reports a referenced file the installed package does not have', async () => {
    const { root, cwd } = makeConsumer();
    const fontsCss = join(root, 'node_modules/@elirobinson/tokens/src/fonts.css');
    writeFileSync(
      fontsCss,
      `${readFileSync(fontsCss, 'utf8')}\n@font-face { src: url('./fonts/missing.woff2'); }\n`,
    );

    const result = await runArtifacts({ cwd });

    expect(result.keptBundled).toEqual([
      'miltinson-design/fonts/missing.woff2 (referenced by miltinson-design/fonts.css, missing from @elirobinson/tokens)',
    ]);
  });

  it('marks every file that has an installed source in the staged stamp', () => {
    const { files } = readArtifactSet(artifactsDir());
    const byPath = Object.fromEntries(files.map((entry) => [entry.path, entry]));

    expect(byPath['miltinson-design/palettes.css'].source).toEqual({
      kind: 'package',
      package: '@elirobinson/tokens',
      path: 'src/palettes.css',
      specifier: '@elirobinson/tokens/palettes.css',
    });
    expect(byPath['miltinson-design/colors_and_type.css'].source).toEqual({
      kind: 'package',
      package: '@elirobinson/tokens',
      path: 'src/tokens.css',
      specifier: '@elirobinson/tokens/tokens.css',
    });
    expect(byPath['miltinson-design/fonts/geist-latin-wght-normal.woff2'].source).toEqual({
      kind: 'package',
      package: '@elirobinson/tokens',
      path: 'src/fonts/geist-latin-wght-normal.woff2',
    });
    for (const name of ['llms.txt', 'llms-full.txt', 'SKILL.md']) {
      expect(byPath[`design-system-reference/${name}`].source).toEqual({ kind: 'reference' });
    }
  });
});
