/* The checks run against the scratch app run.mjs installs. Everything here
 * reads the INSTALLED packages under the app's node_modules, never this repo's
 * sources: the point is what a consumer receives.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { consumerLintConfig } from '../../packages/ai-patterns/src/artifacts/consumer-lint.test-helper.mjs';
import {
  cssImports,
  cssUrls,
  firstRuleAt,
  flatten,
  importsAfterFirstRule,
  isExternal,
  stripQuery,
} from './css.mjs';
import { expandExports, specifierFor } from './exports.mjs';
import { listFiles, readJson, resolveCss } from './resolve.mjs';

/**
 * Every check, and the past release break it would have caught. A failure is
 * reported under its label and issue, so the output says which break came
 * back. This table is the one list of them: add a row for a new check.
 */
export const CHECKS = {
  import: { issue: 68, label: 'import', cause: 'no component loaded under Node ESM' },
  require: { issue: 33, label: 'require', cause: 'a testing helper had no "require" condition' },
  unreachable: { issue: 68, label: 'unreachable export', cause: 'no Node loader reaches it' },
  exportTarget: { issue: 77, label: 'export target', cause: 'a mapped file is not in the tarball' },
  cssImport: { issue: 77, label: 'css @import', cause: 'a shipped @import does not resolve' },
  cssUrl: { issue: 77, label: 'css url()', cause: 'a shipped font or asset is missing' },
  cssOrder: { issue: 76, label: 'css order', cause: 'an @import after a rule is discarded' },
  cssStranded: { issue: 76, label: 'css stranded @import', cause: 'every @font-face was dropped' },
  artifacts: { issue: 77, label: 'ds-resync artifacts', cause: '--write died with ENOENT' },
  lint: { issue: 119, label: 'consumer lint', cause: "the UI kits failed a consumer's ESLint" },
  testFile: { issue: 220, label: 'test file shipped', cause: 'the test suite and harness shipped' },
  manifest: { issue: null, label: 'manifest', cause: 'a packed manifest no registry can install' },
  bin: { issue: null, label: 'bin', cause: 'a documented command fails in a consumer' },
};

const describeCheck = (id) => {
  const { label, issue, cause } = CHECKS[id];
  return issue ? `${label}, repeats #${issue}: ${cause}` : `${label}: ${cause}`;
};

const firstLines = (error) =>
  String(error?.message ?? error)
    .split('\n')
    .slice(0, 3)
    .join('\n');

const JS = new Set(['.js', '.mjs', '.cjs']);

/**
 * #68, #33: what a consumer's `import` and `require` get for each concrete
 * export, read from the packed export map.
 *
 * @returns {Promise<{ subpaths: number, loaded: number, cssExports: string[] }>}
 */
async function checkExports({ name, root, manifest, files, probe, requireFromConsumer, fail }) {
  const subpaths = expandExports(manifest.exports, files);
  const cssExports = [];
  if (subpaths.length === 0) fail('unreachable', name, 'exports nothing a consumer can import');

  let loaded = 0;
  for (const { subpath, passthrough, viaImport, viaRequire, leaves } of subpaths) {
    const specifier = specifierFor(name, subpath);

    for (const leaf of leaves) {
      if (!existsSync(join(root, leaf.file))) {
        const condition = leaf.conditions.join('.') || 'default';
        fail(
          'exportTarget',
          specifier,
          `the "${condition}" target ${leaf.file} is not in the tarball`,
        );
      }
    }

    if (!viaImport && !viaRequire) {
      fail('unreachable', specifier, 'no "import", "require" or "default" condition reaches it');
    }
    if (subpath.startsWith('./testing/') && !viaRequire) {
      fail(
        'require',
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
        fail('import', specifier, firstLines(error));
      }
    }

    if (viaRequire) {
      try {
        requireFromConsumer(specifier);
      } catch (error) {
        fail('require', specifier, firstLines(error));
      }
    }
  }
  return { subpaths: subpaths.length, loaded, cssExports };
}

/** #76, #77: every stylesheet the package ships, read where it was installed. */
function checkStylesheets({ name, root, files, consumer, fail }) {
  const sheets = files.filter((file) => file.endsWith('.css'));
  for (const sheet of sheets) {
    const path = join(root, sheet);
    const css = readFileSync(path, 'utf8');
    const where = `${name}/${sheet.slice(2)}`;

    for (const { specifier } of cssImports(css)) {
      if (!isExternal(specifier) && !resolveCss(specifier, path, consumer)) {
        fail('cssImport', where, `@import '${specifier}' does not resolve in a consumer`);
      }
    }
    for (const reference of cssUrls(css)) {
      if (!isExternal(reference) && !existsSync(join(dirname(path), stripQuery(reference)))) {
        fail('cssUrl', where, `url(${reference}) names a file that is not in the tarball`);
      }
    }
    for (const { statement } of importsAfterFirstRule(css)) {
      fail('cssOrder', where, `${statement.trim()} comes after a rule, so CSS discards it`);
    }
  }
  return sheets.length;
}

/**
 * #76: a CSS export imported the way a Tailwind v4 consumer writes it —
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
      'cssStranded',
      specifier,
      `could not flatten it behind @import 'tailwindcss' (unresolved: ${unresolved.join(', ') || 'none'})`,
    );
    return;
  }
  for (const { statement } of importsAfterFirstRule(flat)) {
    fail(
      'cssStranded',
      specifier,
      `${statement.trim()} survives bundling after Tailwind's rules and is dropped as invalid. ` +
        "Use the string form (@import './x.css'), which bundlers inline.",
    );
  }
}

/* Test files and their compiled output, test helpers, fixtures, and a test
   harness directory. */
const TEST_FILE =
  /(?:\.(?:test|spec)(?:-helper)?\.(?:d\.)?[cm]?[jt]sx?(?:\.map)?$|\/(?:__tests__|__fixtures__|test)\/)/;

/**
 * #220: the tarball carries no test suite. react shipped 41 test files and its
 * harness, each importing vitest and @testing-library, none of which a
 * consumer installs. packages/ai-patterns/src/artifacts/dependency-boundary.test.mjs
 * holds the wider rule (no published import of an undeclared package) against
 * an emulation of `files`; this holds the narrow one against the real pack.
 */
function checkNoTests({ name, files, fail }) {
  for (const file of files.filter((path) => TEST_FILE.test(path))) {
    fail('testFile', `${name}/${file.slice(2)}`, 'is a test file, and ships to every consumer');
  }
}

/** A packed manifest still naming `workspace:` was not packed the way publish packs. */
function checkManifest({ name, manifest, fail }) {
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (range.startsWith('workspace:')) {
        fail(
          'manifest',
          name,
          `${field} names ${dependency}@${range}, which no registry can install`,
        );
      }
    }
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
      if (!existsSync(join(root, file))) {
        fail('bin', `${name} ${command}`, `${file} is not in the tarball`);
      }
    }
  }

  if (!names.includes('@elirobinson/ai-patterns')) return;
  runBin(consumer, ['elirobinson-ds'], 'bin', fail);
  if (runBin(consumer, ['ds-resync', 'artifacts', '--write'], 'artifacts', fail)) {
    const linted = await lintWrittenSkills(consumer, fail);
    log(`ds-resync artifacts --write: wrote the skills; linted ${linted} kit scripts`);
  }
}

/** #119: what `ds-resync artifacts --write` put in `.claude/skills/`, under a consumer's ESLint. */
async function lintWrittenSkills(consumer, fail) {
  const skills = join(consumer, '.claude', 'skills');
  if (!existsSync(skills)) {
    fail('artifacts', 'ds-resync artifacts --write', `wrote nothing to ${skills}`);
    return 0;
  }
  const scripts = listFiles(skills)
    .filter((file) => /\.jsx?$/.test(file))
    .map((file) => join(skills, file));
  if (scripts.length === 0) {
    fail(
      'lint',
      skills,
      'holds no .js or .jsx files, so the UI kit check would pass on nothing. ' +
        'If the brand skill stopped shipping its UI kits on purpose, remove this check.',
    );
    return 0;
  }

  /* ESLint and its plugins come from the scratch app, as a consumer's would. */
  const fromConsumer = createRequire(join(consumer, 'package.json'));
  const load = (specifier) => import(pathToFileURL(fromConsumer.resolve(specifier)).href);
  const [{ ESLint }, { default: js }, { default: react }] = await Promise.all([
    load('eslint'),
    load('@eslint/js'),
    load('eslint-plugin-react'),
  ]);
  const eslint = new ESLint({
    cwd: consumer,
    overrideConfigFile: true,
    overrideConfig: consumerLintConfig({ js, react }),
  });

  const results = await eslint.lintFiles(scripts);
  if (results.length !== scripts.length) {
    fail('lint', skills, `ESLint linted ${results.length} of ${scripts.length} files`);
  }
  for (const result of results) {
    for (const message of result.messages) {
      fail(
        'lint',
        `${relative(consumer, result.filePath)}:${message.line}`,
        `${message.ruleId ?? 'eslint'}: ${message.message}`,
      );
    }
  }
  return results.length;
}

/**
 * Every check, against the installed scratch app.
 *
 * @returns {Promise<{ check: string, subject: string, message: string }[]>}
 */
export async function checkConsumer({ consumer, names, probe, log }) {
  const failures = [];
  const fail = (id, subject, message) =>
    failures.push({ check: describeCheck(id), subject, message });
  const requireFromConsumer = createRequire(join(consumer, 'package.json'));

  let cssExportCount = 0;
  for (const name of names) {
    const root = realpathSync(join(consumer, 'node_modules', name));
    const manifest = readJson(join(root, 'package.json'));
    const files = listFiles(root);

    const exported = await checkExports({
      name,
      root,
      manifest,
      files,
      probe,
      requireFromConsumer,
      fail,
    });
    const sheets = checkStylesheets({ name, root, files, consumer, fail });
    for (const specifier of exported.cssExports) checkFlattened({ specifier, consumer, fail });
    cssExportCount += exported.cssExports.length;
    checkNoTests({ name, files, fail });
    checkManifest({ name, manifest, fail });

    log(
      `${name}: ${exported.loaded}/${exported.subpaths} subpaths loaded, ` +
        `${sheets} stylesheets, ${files.length} files`,
    );
  }

  /* tokens and react export stylesheets. With none found, the #76 flatten
     check above ran on nothing. */
  if (cssExportCount === 0) {
    fail(
      'cssStranded',
      'every package',
      'no CSS export was found to flatten, so #76 went unchecked',
    );
  }

  await checkBins({ consumer, names, fail, log });
  return failures;
}
