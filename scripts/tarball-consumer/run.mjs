#!/usr/bin/env node
/* Packs every published @elirobinson/* package, installs the tarballs into a
 * scratch app outside the repo, and loads them the way a consumer does (#327).
 *
 * Every check here exists because a release once broke consumers while every
 * test in this repo passed. Each failure message names the issue it guards:
 *
 *   #68   no component loads under Node ESM     → every exports subpath is imported
 *   #33   a testing helper had no `require`      → every `require` condition is required,
 *                                                  and ./testing/* must have one
 *   #76   tokens.css @import stranded and dropped → every CSS export is flattened
 *                                                  behind `@import 'tailwindcss'`
 *   #77   manifest listed fonts pack dropped     → every @import and url() resolves, and
 *                                                  `ds-resync artifacts --write` runs
 *   #119  shipped UI kits fail a consumer's lint → the written skills are linted
 *   #220  the test suite shipped                 → no test file is in any tarball
 *
 * The subpath list is read from each packed package.json, so a new export is
 * covered with no edit here. Tarballs are made with `pnpm pack`, the packer
 * `changeset publish` uses, so `workspace:*` is rewritten exactly as it is on
 * release.
 *
 *   node scripts/tarball-consumer/run.mjs           # pack, install, check
 *   node scripts/tarball-consumer/run.mjs --keep    # and leave the scratch app
 *
 * Run it after `pnpm build`: it packs whatever `dist/` holds.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkConsumer } from './checks.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const keep = process.argv.includes('--keep');

/* What a Tailwind v4 consumer of this system has installed besides our own
   packages. Peers come from the packed manifests; these are the rest. Ranges
   are read from the repo root where it declares the package, so the scratch
   install resolves what this repo already tests against. */
const CONSUMER_EXTRAS = ['tailwindcss', '@eslint/js', 'eslint-plugin-react'];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `\`${[command, ...args].join(' ')}\` failed in ${cwd}:\n` +
        `${(result.stderr || result.stdout || '').trim() || '(no output)'}`,
    );
  }
  return result.stdout;
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function publishedPackages() {
  const root = join(REPO, 'packages');
  return readdirSync(root)
    .map((dir) => join(root, dir))
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .map((dir) => ({ dir, manifest: readJson(join(dir, 'package.json')) }))
    .filter(({ manifest }) => !manifest.private);
}

function pack(pkg, destination) {
  const out = join(destination, pkg.manifest.name.replace(/^@/, '').replace('/', '-'));
  mkdirSync(out, { recursive: true });
  run('pnpm', ['pack', '--pack-destination', out], pkg.dir);
  const tarball = readdirSync(out).find((name) => name.endsWith('.tgz'));
  if (!tarball) throw new Error(`pnpm pack produced no tarball for ${pkg.manifest.name}`);
  return join(out, tarball);
}

/** The scratch app: our tarballs, their peers, and a Tailwind/ESLint toolchain. */
function writeConsumer(consumer, tarballs, packages) {
  const rootManifest = readJson(join(REPO, 'package.json'));
  const repoRange = (name) =>
    rootManifest.devDependencies?.[name] ?? rootManifest.dependencies?.[name];

  const dependencies = {};
  for (const [name, tarball] of Object.entries(tarballs)) dependencies[name] = `file:${tarball}`;
  for (const { manifest } of packages) {
    for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
      if (!dependencies[name]) dependencies[name] = repoRange(name) ?? range;
    }
  }
  for (const name of CONSUMER_EXTRAS) {
    if (!dependencies[name]) dependencies[name] = repoRange(name) ?? 'latest';
  }

  writeFileSync(
    join(consumer, 'package.json'),
    `${JSON.stringify({ name: 'tarball-consumer', private: true, type: 'module', dependencies }, null, 2)}\n`,
  );

  /* A packed package names its siblings by version (`@elirobinson/tokens:
     0.20.1`). Point those at the tarballs too, so nothing is fetched from the
     registry and the pair under test is the pair being released. */
  const overrides = Object.entries(tarballs)
    .map(([name, tarball]) => `  '${name}': 'file:${tarball}'`)
    .join('\n');
  writeFileSync(join(consumer, 'pnpm-workspace.yaml'), `overrides:\n${overrides}\n`);

  /* Loads run from here, so they resolve from the scratch app's node_modules
     and never from this repo's. */
  writeFileSync(
    join(consumer, 'probe.mjs'),
    'export const resolveSpecifier = (specifier) => import.meta.resolve(specifier);\n' +
      'export const load = (specifier, options) => import(specifier, options);\n',
  );
}

const started = Date.now();
const scratch = mkdtempSync(join(tmpdir(), 'ds-tarball-consumer-'));
const consumer = join(scratch, 'app');
mkdirSync(consumer);

let failures;
try {
  const packages = publishedPackages();
  const tarballs = {};
  for (const pkg of packages) {
    tarballs[pkg.manifest.name] = pack(pkg, join(scratch, 'tarballs'));
    console.log(`packed ${relative(scratch, tarballs[pkg.manifest.name])}`);
  }

  writeConsumer(consumer, tarballs, packages);
  run('pnpm', ['install', '--prefer-offline', '--reporter=silent'], consumer);
  console.log(`installed into ${consumer}`);

  /* Every Node-side runner a consumer tests with (Vitest, Jest) stubs a
     stylesheet imported from JavaScript, and the vendored AI Elements canvas
     imports @xyflow/react's. Stub it here the same way, so a component that
     needs a bundler for CSS is not reported as one that cannot load. An
     extensionless specifier (#68) is still a failure: no runner fixes that. */
  registerHooks({
    load(url, context, nextLoad) {
      if (new URL(url).pathname.endsWith('.css')) {
        return { format: 'module', source: 'export default {};', shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });

  const probe = await import(pathToFileURL(join(consumer, 'probe.mjs')).href);
  failures = await checkConsumer({
    consumer,
    names: Object.keys(tarballs),
    probe,
    log: (line) => console.log(line),
  });
} finally {
  if (keep) console.log(`kept ${scratch}`);
  else rmSync(scratch, { recursive: true, force: true });
}

const seconds = ((Date.now() - started) / 1000).toFixed(0);
if (failures.length > 0) {
  console.error(`\n${failures.length} consumer failure(s) in the packed packages (${seconds}s):\n`);
  for (const failure of failures) {
    console.error(
      `  [${failure.check}] ${failure.subject}\n    ${failure.message.split('\n').join('\n    ')}`,
    );
  }
  process.exit(1);
}
console.log(`\nevery packed package installs and loads in a consumer (${seconds}s)`);
/* An imported module may hold a handle open (a timer, a server); the checks
   are done, so do not wait for it. */
process.exit(0);
