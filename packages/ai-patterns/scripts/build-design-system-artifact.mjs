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
 * --print-inputs  print the artifact paths --previous must hold, as a JSON
 *             array for an Artifact read, and stop.
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
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
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

/* Where an uncommitted edit would change the output without changing the stamp. */
const STAMPED_SOURCES = ['packages/tokens/src', 'packages/react/src', 'apps/docs/src/app'];

/* pnpm -F runs this from the package folder; resolve what the person typed from where they typed it. */
const invokedFrom = process.env.INIT_CWD ?? process.cwd();

/** The real path, through symlinks such as macOS's /tmp, of a path that may not exist yet. */
function realPath(path) {
  /* .native also fixes the letter case on a case-insensitive disk, so the --out guard compares like with like. */
  if (existsSync(path)) return realpathSync.native(path);
  return join(realPath(dirname(path)), basename(path));
}

const REPORT_LINES = [
  ['newTokens', 'new tokens with no usage note yet'],
  ['notPlaced', 'in the repo but not in tokens.json (no family fits)'],
  ['keptFromPrevious', 'kept from the artifact, not declared in the repo'],
  [
    'droppedComponents',
    'components dropped from the artifact (their previews and README stay; remove them)',
  ],
  [
    'droppedColours',
    'colours dropped from the artifact (no longer in the repo; previews that name them break)',
  ],
];

function contentType(path) {
  const type = CONTENT_TYPES[path.slice(path.lastIndexOf('.'))];
  if (!type) throw new Error(`no content type for ${path}`);
  return type;
}

async function main() {
  const { values } = parseArgs({
    options: {
      previous: { type: 'string' },
      out: { type: 'string' },
      'print-inputs': { type: 'boolean' },
    },
  });
  if (values['print-inputs']) {
    const paths = PREVIOUS_INPUTS.map((path) => `project/${path}`);
    process.stdout.write(`${JSON.stringify(paths, null, 2)}\n`);
    return;
  }
  if (!values.previous) {
    throw new Error(
      "--previous <dir> is required: a local copy of the live artifact's project/ files. " +
        'See docs/agents/design-system-artifact.md.',
    );
  }
  const previousDir = realPath(resolve(invokedFrom, values.previous));
  const missing = PREVIOUS_INPUTS.filter((path) => !existsSync(join(previousDir, path)));
  if (missing.length) throw new Error(`--previous ${previousDir} is missing ${missing.join(', ')}`);
  const outRoot = realPath(
    values.out ? resolve(invokedFrom, values.out) : join(repoRoot, 'dist/design-system-artifact'),
  );
  const outDir = join(outRoot, 'project');
  const fromOut = relative(outDir, previousDir);
  if (fromOut !== '..' && !fromOut.startsWith(`..${sep}`)) {
    throw new Error(`--out ${outRoot} would delete --previous ${previousDir}. Pick another --out.`);
  }

  /* bundle.js and the types come from react's dist, so build it now: the
     output is stamped with HEAD's sha and must not ship an older dist. Nx
     replays it from cache when nothing changed. */
  execFileSync('pnpm', ['nx', 'run', 'react:build'], { cwd: repoRoot, stdio: 'inherit' });

  const require = createRequire(import.meta.url);
  let manifestPath;
  try {
    manifestPath = require.resolve('@elirobinson/react/manifest');
  } catch {
    throw new Error('react:build finished but @elirobinson/react has no dist/manifest.json.');
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const reactDist = dirname(manifestPath);
  const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  const sha = git('rev-parse', '--short', 'HEAD');
  /* A detached HEAD has no branch name to stamp. */
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  /* An uncommitted source edit is in the output but not in the sha. */
  const dirty = git('status', '--porcelain', '--', ...STAMPED_SOURCES) !== '';
  const stamp = dirty ? `${sha}-dirty` : sha;
  const ref = branch === 'HEAD' ? stamp : `${branch}@${stamp}`;
  const previousText = (path) => readFileSync(join(previousDir, path), 'utf8');

  const tokens = buildTokens({
    srcDir: tokensSrc,
    previous: JSON.parse(previousText('tokens.json')),
    meta: { ref, synced: new Date().toLocaleDateString('en-CA') },
  });
  const bundleCss = buildBundleCss({
    repoRoot,
    tokensSrc,
    extrasCss: tokens.extrasCss,
    previousBundleCss: previousText('components/bundle.css'),
    reactVersion: manifest.version,
    ref: stamp,
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

  /* A component that left the manifest leaves bundle.js, but its artifact-owned previews stay. */
  const built = new Set(components.map((component) => component.name));
  const report = {
    ...tokens.report,
    droppedComponents: [...previousText('components/index.d.ts').matchAll(/^\/\/ ── (\w+)$/gm)]
      .map((match) => match[1])
      .filter((name) => !built.has(name)),
  };
  const lines = [
    `design-system-artifact: ${paths.length} files, ${tokens.json.color.tokens.length} colours x ${tokens.json.color.themes.length} themes, ` +
      `${components.length} components (${manifest.package}@${manifest.version}, ${stamp}) -> ${relative(repoRoot, outDir)}`,
  ];
  for (const [key, label] of REPORT_LINES) {
    if (report[key].length) lines.push(`  ${label}: ${report[key].join(', ')}`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
