#!/usr/bin/env node
/* Builds the repo-owned files of the Claude "Design System" artifact
 * (https://claude.ai/artifact/Xvkzcg7hpZRPBZ5ijZcTL1) into a local folder.
 *
 *   pnpm -F @elirobinson/ai-patterns build:design-system-artifact --previous <dir>
 *
 * --previous  a local copy of the live artifact's `project/` files (read them
 *             with the Artifact tool). Prose and the two artifact-only
 *             components are read from it, so a rebuild keeps what was
 *             written on the artifact's page.
 * --out       where to write. Default: <repo>/dist/design-system-artifact, which no
 *             package publishes.
 *
 * Writes <out>/project/<path> for each file below, and <out>/publish-files.json,
 * the `files` map to publish them in one call. docs/agents/design-system-artifact.md
 * has the publish steps.
 *
 * The split is one-directional per file. The repo owns these files; the
 * artifact owns everything else (README, guides, previews, ui_kits,
 * templates, design-system.json). Nothing here writes those.
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { ARTIFACT_ONLY } from './design-system-artifact/artifact-only.mjs';
import { buildBundleJs } from './design-system-artifact/bundle.mjs';
import { checkLimits } from './design-system-artifact/limits.mjs';
import { buildBundleCss } from './design-system-artifact/stylesheet.mjs';
import { buildTokens, latinFonts } from './design-system-artifact/tokens.mjs';
import { buildTypes } from './design-system-artifact/types.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(packageDir, '..', '..');
const tokensSrc = join(repoRoot, 'packages/tokens/src');

/* The files read from the live artifact. */
const PREVIOUS_INPUTS = [
  'tokens.json',
  'components/bundle.css',
  'components/index.d.ts',
  ...ARTIFACT_ONLY.names.map(ARTIFACT_ONLY.source),
];

const CONTENT_TYPES = {
  '.json': 'application/json',
  '.css': 'text/css',
  /* The artifact serves code as text. */
  '.js': 'text/plain',
  '.ts': 'text/plain',
  '.woff2': 'font/woff2',
};

function contentType(path) {
  const type = CONTENT_TYPES[path.slice(path.lastIndexOf('.'))];
  if (!type) throw new Error(`no content type for ${path}`);
  return type;
}

async function main() {
  const { values } = parseArgs({
    options: { previous: { type: 'string' }, out: { type: 'string' } },
  });
  if (!values.previous) {
    throw new Error(
      "--previous <dir> is required: a local copy of the live artifact's project/ files. " +
        'See docs/agents/design-system-artifact.md.',
    );
  }
  const previousDir = resolve(values.previous);
  const missing = PREVIOUS_INPUTS.filter((path) => !existsSync(join(previousDir, path)));
  if (missing.length) throw new Error(`--previous ${previousDir} is missing ${missing.join(', ')}`);
  const outRoot = resolve(values.out ?? join(repoRoot, 'dist/design-system-artifact'));
  const outDir = join(outRoot, 'project');
  if (!relative(outDir, previousDir).startsWith('..')) {
    throw new Error(`--out ${outRoot} would delete --previous ${previousDir}. Pick another --out.`);
  }

  const require = createRequire(import.meta.url);
  let manifestPath;
  try {
    manifestPath = require.resolve('@elirobinson/react/manifest');
  } catch {
    throw new Error('@elirobinson/react has no dist/manifest.json. Run `pnpm nx run react:build`.');
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const reactDist = dirname(manifestPath);
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  const previousText = (path) => readFileSync(join(previousDir, path), 'utf8');

  const tokens = buildTokens({
    srcDir: tokensSrc,
    previous: JSON.parse(previousText('tokens.json')),
    meta: { ref: `main@${sha}`, synced: new Date().toISOString().slice(0, 10) },
  });
  const bundleCss = buildBundleCss({
    repoRoot,
    extrasCss: tokens.extrasCss,
    previousBundleCss: previousText('components/bundle.css'),
    reactVersion: manifest.version,
    ref: sha,
  });
  const { js: bundleJs, components } = await buildBundleJs({ manifest, reactDist, previousDir });
  const types = buildTypes({
    manifest,
    reactDist,
    previousIndexDts: previousText('components/index.d.ts'),
  });

  const files = new Map([
    ['tokens.json', `${JSON.stringify(tokens.json, null, 2)}\n`],
    ['tokens.css', tokens.css],
    ['components/bundle.js', bundleJs],
    ['components/bundle.css', bundleCss],
    ['components/index.d.ts', types.index],
  ]);
  for (const [name, text] of types.perComponent) files.set(`components/${name}/${name}.d.ts`, text);
  const fonts = new Map(
    latinFonts(tokensSrc).map((font) => [
      `fonts/${font.file}`,
      join(tokensSrc, 'fonts', font.file),
    ]),
  );

  /* Check every cap before touching the output folder. */
  const sizes = {
    ...Object.fromEntries([...files].map(([path, text]) => [path, Buffer.byteLength(text)])),
    ...Object.fromEntries([...fonts].map(([path, source]) => [path, statSync(source).size])),
  };
  checkLimits({ tokensJson: tokens.json, sizes });
  const paths = Object.keys(sizes);

  /* Remove only what this script writes: --out may name a folder that holds other things. */
  rmSync(outDir, { recursive: true, force: true });
  rmSync(join(outRoot, 'publish-files.json'), { force: true });
  for (const [path, text] of files) {
    mkdirSync(dirname(join(outDir, path)), { recursive: true });
    writeFileSync(join(outDir, path), text);
  }
  mkdirSync(join(outDir, 'fonts'), { recursive: true });
  for (const [path, source] of fonts) copyFileSync(source, join(outDir, path));

  const publish = Object.fromEntries(
    paths.map((path) => [
      `project/${path}`,
      { from: join(outDir, path), contentType: contentType(path) },
    ]),
  );
  writeFileSync(join(outRoot, 'publish-files.json'), `${JSON.stringify(publish, null, 2)}\n`);

  const { report } = tokens;
  const lines = [
    `design-system-artifact: ${paths.length} files, ${tokens.json.color.tokens.length} colours x ${tokens.json.color.themes.length} themes, ` +
      `${components.length} components (${manifest.package}@${manifest.version}, ${sha}) -> ${relative(repoRoot, outDir)}`,
  ];
  if (report.newTokens.length) {
    lines.push(`  new tokens with no usage note yet: ${report.newTokens.join(', ')}`);
  }
  if (report.notPlaced.length) {
    lines.push(
      `  in the repo but not in tokens.json (no family fits): ${report.notPlaced.join(', ')}`,
    );
  }
  if (report.keptFromPrevious.length) {
    lines.push(
      `  kept from the artifact, not declared in the repo: ${report.keptFromPrevious.join(', ')}`,
    );
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
