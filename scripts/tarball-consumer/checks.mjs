/* The checks run against the scratch app run.mjs installs. Everything here
 * reads the INSTALLED packages under the app's node_modules, never this repo's
 * sources: the point is what a consumer receives.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  cssImports,
  cssUrls,
  firstRuleAt,
  flatten,
  importsAfterFirstRule,
  isExternal,
  stripQuery,
} from './css.mjs';
import { expandExports, resolveExport, specifierFor } from './exports.mjs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Every file in an installed package, as `./`-prefixed paths. */
function packageFiles(root, prefix = '.') {
  const found = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...packageFiles(root, path));
    else found.push(path);
  }
  return found;
}

/** `@scope/name/sub/path` → `@scope/name`; `name/sub` → `name`. */
export function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** The installed package directory `name` resolves to from `fromDir`, pnpm layout included. */
function findPackageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/* The conditions a CSS bundler resolves a bare @import with. `style` is what
   tailwindcss uses to point `@import 'tailwindcss'` at its stylesheet. */
const CSS_CONDITIONS = ['style'];

/** Resolves a CSS @import the way a bundler does, or returns null. */
function resolveCss(specifier, fromFile, consumer) {
  if (specifier.startsWith('.')) {
    const file = join(dirname(fromFile), specifier);
    return existsSync(file) ? file : null;
  }
  const name = packageName(specifier);
  const dir = findPackageDir(name, fromFile ? dirname(fromFile) : consumer);
  if (!dir) return null;
  const manifest = readJson(join(dir, 'package.json'));
  const subpath = `.${specifier.slice(name.length)}`;
  let target;
  if (manifest.exports) target = resolveExport(manifest.exports, subpath, CSS_CONDITIONS);
  else target = subpath === '.' ? (manifest.style ?? manifest.main) : subpath;
  if (!target) return null;
  const file = join(dir, target);
  return existsSync(file) ? file : null;
}

const JS = new Set(['.js', '.mjs', '.cjs']);
const RUNTIME_IMPORT = new Set(['import', 'node', 'default']);

/**
 * #68, #33 and every other subpath: what a consumer's `import` and `require`
 * get for each concrete export.
 */
async function checkExports({ name, root, manifest, files, probe, require, fail, cssExports }) {
  const subpaths = expandExports(manifest.exports, files);
  if (subpaths.length === 0) fail('exports', name, 'exports nothing a consumer can import');

  let loaded = 0;
  for (const { subpath, passthrough, leaves } of subpaths) {
    const specifier = specifierFor(name, subpath);

    for (const leaf of leaves) {
      if (!existsSync(join(root, leaf.file))) {
        fail(
          'exports',
          specifier,
          `the "${leaf.conditions.join('.') || 'default'}" target ${leaf.file} is not in the tarball`,
        );
      }
    }

    const viaImport = leaves.some((leaf) => leaf.conditions.every((c) => RUNTIME_IMPORT.has(c)));
    const viaRequire = leaves.some((leaf) => leaf.conditions.includes('require'));

    if (subpath.startsWith('./testing/') && !viaRequire) {
      fail(
        'require (#33)',
        specifier,
        'has no "require" condition. Playwright compiles a plain .ts spec to CommonJS, ' +
          'so a testing helper without one throws ERR_PACKAGE_PATH_NOT_EXPORTED.',
      );
    }

    if (viaImport) {
      try {
        const file = fileURLToPath(probe.resolveSpecifier(specifier));
        const extension = extname(file);
        /* A passthrough export hands out files to read or copy — the brand
           skill's UI kits are browser scripts, not modules — so it only has to
           resolve to something that is there. */
        if (passthrough || !(JS.has(extension) || extension === '.json')) {
          if (!existsSync(file)) throw new Error(`resolves to ${file}, which does not exist`);
        } else if (extension === '.json') {
          await probe.load(specifier, { with: { type: 'json' } });
        } else {
          await probe.load(specifier);
        }
        if (extension === '.css' && !passthrough) cssExports.push(specifier);
        loaded += 1;
      } catch (error) {
        fail('import (#68)', specifier, firstLines(error));
      }
    }

    if (viaRequire) {
      try {
        require(specifier);
      } catch (error) {
        fail('require (#33)', specifier, firstLines(error));
      }
    }
  }
  return { subpaths: subpaths.length, loaded };
}

const firstLines = (error) =>
  String(error?.message ?? error)
    .split('\n')
    .slice(0, 3)
    .join('\n');

/**
 * #76 and #77: every stylesheet the package ships, read where it was installed.
 */
function checkStylesheets({ name, root, files, consumer, fail }) {
  const sheets = files.filter((file) => file.endsWith('.css'));
  for (const sheet of sheets) {
    const path = join(root, sheet);
    const css = readFileSync(path, 'utf8');
    const where = `${name}/${sheet.slice(2)}`;

    for (const { specifier } of cssImports(css)) {
      if (isExternal(specifier)) continue;
      if (!resolveCss(specifier, path, consumer)) {
        fail('css @import (#77)', where, `@import '${specifier}' does not resolve in a consumer`);
      }
    }
    for (const reference of cssUrls(css)) {
      if (isExternal(reference) || reference.startsWith('data:')) continue;
      if (!existsSync(join(dirname(path), stripQuery(reference)))) {
        fail('css url() (#77)', where, `url(${reference}) names a file that is not in the tarball`);
      }
    }
    for (const { statement } of importsAfterFirstRule(css)) {
      fail('css order (#76)', where, `${statement.trim()} comes after a rule, so CSS discards it`);
    }
  }
  return sheets.length;
}

/**
 * #76: each CSS export, imported the way a Tailwind v4 consumer writes it —
 * `@import 'tailwindcss'` first, as v4 requires — then flattened the way a
 * bundler flattens it. An @import left standing after a rule is dropped.
 */
function checkFlattened({ specifier, consumer, fail }) {
  const entry = `@import 'tailwindcss';\n@import '${specifier}';\n`;
  const unresolved = [];
  const load = (spec, from) => {
    const file = resolveCss(spec, from, consumer);
    if (!file) unresolved.push(spec);
    return file ? { file, css: readFileSync(file, 'utf8') } : null;
  };
  const flat = flatten(entry, load);

  /* Without Tailwind's rules inlined ahead of the export there is nothing for
     an import to be stranded behind, and the check below would pass on
     anything. */
  if (unresolved.length > 0 || firstRuleAt(flat) === -1) {
    fail(
      'css stranded @import (#76)',
      specifier,
      `could not flatten it behind @import 'tailwindcss' (unresolved: ${unresolved.join(', ') || 'none'})`,
    );
    return;
  }
  for (const { statement } of importsAfterFirstRule(flat)) {
    fail(
      'css stranded @import (#76)',
      specifier,
      `${statement.trim()} survives bundling after Tailwind's rules and is dropped as invalid. ` +
        "Use the string form (@import './x.css'), which bundlers inline.",
    );
  }
}

/* Test files, test helpers, fixtures and a test harness directory. */
const TEST_FILE =
  /(?:\.(?:test|spec)(?:-helper)?\.[cm]?[jt]sx?$|\/(?:__tests__|__fixtures__|test)\/)/;

/**
 * #220: the tarball carries no test suite. react shipped 41 test files and its
 * harness, each importing vitest and @testing-library, none of which a
 * consumer installs. packages/ai-patterns/src/artifacts/dependency-boundary.test.mjs
 * holds the wider rule (no published import of an undeclared package) against
 * an emulation of `files`; this holds the narrow one against the real pack.
 */
function checkNoTests({ name, files, fail }) {
  for (const file of files.filter((path) => TEST_FILE.test(path))) {
    fail(
      'test file shipped (#220)',
      `${name}/${file.slice(2)}`,
      'is a test file, and ships to every consumer',
    );
  }
}

/** Runs one of the scratch app's bins the way a consumer does, failing on a non-zero exit. */
function runBin(consumer, args, check, fail) {
  const result = spawnSync('pnpm', ['exec', ...args], {
    cwd: consumer,
    encoding: 'utf8',
    timeout: 120_000,
  });
  const ok = !result.error && result.status === 0;
  if (!ok) {
    const output = (result.stderr || result.stdout || '').trim().split('\n').slice(-8).join('\n');
    fail(
      check,
      args.join(' '),
      result.error ? firstLines(result.error) : output || `exit ${result.status}`,
    );
  }
  return ok;
}

/**
 * #77 and #119, the documented consumer steps: ask the CLI what exists, write
 * the skills into the app, then lint what was written with a consumer's config.
 */
async function checkBins({ consumer, names, fail, log }) {
  for (const name of names) {
    const root = realpathSync(join(consumer, 'node_modules', name));
    const { bin } = readJson(join(root, 'package.json'));
    const bins = typeof bin === 'string' ? { [name.split('/').pop()]: bin } : (bin ?? {});
    for (const [command, file] of Object.entries(bins)) {
      if (!existsSync(join(root, file)))
        fail('bin', `${name} ${command}`, `${file} is not in the tarball`);
    }
  }

  if (!names.includes('@elirobinson/ai-patterns')) return;
  runBin(consumer, ['elirobinson-ds'], 'bin', fail);
  if (runBin(consumer, ['ds-resync', 'artifacts', '--write'], 'ds-resync artifacts (#77)', fail)) {
    const linted = await lintWrittenSkills(consumer, fail);
    log(`ds-resync artifacts --write: wrote the skills; linted ${linted} kit scripts`);
  }
}

/** #119: what `ds-resync artifacts --write` put in `.claude/skills/`, under a consumer's ESLint. */
async function lintWrittenSkills(consumer, fail) {
  const skills = join(consumer, '.claude', 'skills');
  if (!existsSync(skills)) {
    fail('ds-resync artifacts (#77)', 'ds-resync artifacts --write', `wrote nothing to ${skills}`);
    return;
  }
  const scripts = packageFilesUnder(skills).filter((file) => /\.jsx?$/.test(file));
  if (scripts.length === 0) {
    fail(
      'consumer lint (#119)',
      skills,
      'holds no .js or .jsx files, so the UI kit check would pass on nothing. ' +
        'If the brand skill stopped shipping its UI kits on purpose, remove this check.',
    );
    return 0;
  }

  const fromConsumer = createRequire(join(consumer, 'package.json'));
  const load = (specifier) => import(pathToFileURL(fromConsumer.resolve(specifier)).href);
  const [{ ESLint }, { default: js }, { default: react }] = await Promise.all([
    load('eslint'),
    load('@eslint/js'),
    load('eslint-plugin-react'),
  ]);

  /* A typical consumer's rules over .jsx — the same stand-in
     packages/ai-patterns/src/artifacts/ui-kits-lint.test.mjs uses for the
     source tree, applied here to what a consumer actually receives. */
  const eslint = new ESLint({
    cwd: consumer,
    overrideConfigFile: true,
    overrideConfig: [
      js.configs.recommended,
      { linterOptions: { reportUnusedDisableDirectives: 'error' } },
      {
        files: ['**/*.jsx', '**/*.js'],
        plugins: { react },
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        settings: { react: { version: '19.0.0' } },
        rules: { 'react/jsx-no-undef': 'error' },
      },
    ],
  });
  const results = await eslint.lintFiles(scripts);
  if (results.length !== scripts.length) {
    fail(
      'consumer lint (#119)',
      skills,
      `ESLint linted ${results.length} of ${scripts.length} files`,
    );
  }
  for (const result of results) {
    for (const message of result.messages) {
      fail(
        'consumer lint (#119)',
        `${relative(consumer, result.filePath)}:${message.line}`,
        `${message.ruleId ?? 'eslint'}: ${message.message}`,
      );
    }
  }
  return results.length;
}

function packageFilesUnder(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Every check, against the installed scratch app.
 *
 * @returns {Promise<{ check: string, subject: string, message: string }[]>}
 */
export async function checkConsumer({ consumer, names, probe, log }) {
  const failures = [];
  const fail = (check, subject, message) => failures.push({ check, subject, message });
  const require = createRequire(join(consumer, 'package.json'));

  for (const name of names) {
    const root = realpathSync(join(consumer, 'node_modules', name));
    const manifest = readJson(join(root, 'package.json'));
    const files = packageFiles(root);
    const cssExports = [];

    const exportsSeen = await checkExports({
      name,
      root,
      manifest,
      files,
      probe,
      require,
      fail,
      cssExports,
    });
    const sheets = checkStylesheets({ name, root, files, consumer, fail });
    for (const specifier of cssExports) checkFlattened({ specifier, consumer, fail });
    checkNoTests({ name, files, fail });

    for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
      if (range.startsWith('workspace:')) {
        fail('manifest', name, `depends on ${dependency}@${range}, which no registry can install`);
      }
    }

    log(
      `${name}: ${exportsSeen.loaded}/${exportsSeen.subpaths} subpaths loaded, ` +
        `${sheets} stylesheets, ${files.length} files`,
    );
  }

  await checkBins({ consumer, names, fail, log });
  return failures;
}
