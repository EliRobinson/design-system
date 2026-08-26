// Playwright compiles a plain `.ts` spec — and `playwright.config.ts` itself —
// to CommonJS, so a consumer following the documented example resolves these
// subpaths through `require`, not `import`. The export map for
// `./testing/playwright` originally declared only an `import` condition, so
// that spec died on `ERR_PACKAGE_PATH_NOT_EXPORTED` before a single assertion
// ran (issue #33).
//
// The `require` condition points at the same `.mjs` the `import` condition
// does, which only works because Node can `require()` an ES module that has no
// top-level await. Both halves of that are load-bearing and neither is visible
// from inside this repo, so both are pinned here for every testing subpath:
//
//   - `require.resolve` exercises Node's real export-map resolution under the
//     `require` condition, so deleting the condition fails this file rather
//     than a consumer's E2E suite.
//   - actually `require()`-ing the module proves it stays synchronous. A
//     top-level await added to any of them would throw ERR_REQUIRE_ASYNC_MODULE
//     and silently re-break the documented `.ts` form.
//
// Both use a *self-referencing* specifier (`@elirobinson/ai-patterns/...`),
// which Node resolves against this package's own `exports` — the same code path
// a consumer's `node_modules` takes, with no install needed.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

/* `load` is a literal import per entry rather than a computed one: a bundler
   cannot follow `import(`./${file}`)` and warns about it. */
const SUBPATHS = [
  {
    subpath: '@elirobinson/ai-patterns/testing/playwright',
    file: 'playwright.mjs',
    load: () => import('./playwright.mjs'),
    /* One export per module that a consumer's spec or config actually calls,
       so a resolution that succeeds but lands on the wrong file still fails. */
    callable: 'expectDesignSystemContracts',
  },
  {
    subpath: '@elirobinson/ai-patterns/testing/visual-config',
    file: 'visual-config.mjs',
    load: () => import('./visual-config.mjs'),
    callable: 'defineVisualConfig',
  },
  {
    subpath: '@elirobinson/ai-patterns/testing/visual-sweep',
    file: 'visual-sweep.mjs',
    load: () => import('./visual-sweep.mjs'),
    callable: 'sweepStorybook',
  },
  {
    subpath: '@elirobinson/ai-patterns/testing/preflight-sweep',
    file: 'preflight-sweep.mjs',
    load: () => import('./preflight-sweep.mjs'),
    callable: 'findPreflightSensitiveElements',
  },
];

describe.each(SUBPATHS)('$subpath resolves from CommonJS', ({ subpath, file, load, callable }) => {
  const modulePath = fileURLToPath(new URL(`./${file}`, import.meta.url));

  it('resolves the subpath under the require condition', () => {
    let resolved;
    try {
      resolved = require.resolve(subpath);
    } catch (error) {
      throw new Error(
        `require.resolve('${subpath}') failed with ${error.code} — a CommonJS ` +
          'Playwright spec or config (any plain `.ts` file) cannot import this ' +
          'module. The `require` condition is missing from the export map.',
        { cause: error },
      );
    }

    expect(resolved, 'the require condition points somewhere unexpected').toBe(modulePath);
  });

  it('requires the module without hitting ERR_REQUIRE_ASYNC_MODULE', async () => {
    const required = require(subpath);
    const imported = await load();

    expect(typeof required[callable], `${callable} is not callable when required from CJS`).toBe(
      'function',
    );

    // The two conditions deliberately resolve to the same file; a future CJS
    // build must keep the export surface identical or consumers get a
    // dual-package split depending on how their spec was compiled.
    expect(Object.keys(required).sort()).toEqual(
      Object.keys(imported)
        .filter((name) => name !== 'default')
        .sort(),
    );
  });
});

describe('the testing export map', () => {
  /* Which suffixes are internal is package.json's call, not this file's: `files`
     already un-ships them, and a module that does not ship must not be demanded
     of the export map below. Derived rather than restated so that adding an
     exclusion there cannot leave this check quietly wrong in either direction —
     a suffix added here alone would hide a genuinely unexported module. */
  const internalSuffixes = require('../../package.json')
    .files.filter((entry) => entry.startsWith('!'))
    .map((entry) => entry.replace(/^!src\/\*\*\/\*/, ''));

  /* A module added under src/testing without an `exports` entry is invisible to
     consumers, and the only symptom is an import that fails in their repo. */
  it('publishes every testing module', async () => {
    const { readdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');

    const directory = dirname(fileURLToPath(import.meta.url));
    const modules = readdirSync(directory).filter(
      (file) => file.endsWith('.mjs') && !internalSuffixes.some((suffix) => file.endsWith(suffix)),
    );

    expect(modules.sort()).toEqual(SUBPATHS.map(({ file }) => file).sort());
  });

  /* The derivation above is only as good as the shape it assumes. If a future
     exclusion is written some other way — a bare directory, a different glob —
     the `replace` yields something that ends nothing, and every module would
     start looking publishable again. */
  it('reads every `files` exclusion as a suffix, which is the shape it assumes', () => {
    expect(internalSuffixes.length).toBeGreaterThan(0);
    for (const suffix of internalSuffixes) {
      expect(suffix, 'a `files` exclusion is not a `!src/**/*<suffix>` glob').toMatch(
        /^\.[\w.-]+\.mjs$/,
      );
    }
  });
});
