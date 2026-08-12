// Playwright compiles a plain `.ts` spec to CommonJS, so a consumer following
// the documented example resolves `@elirobinson/ai-patterns/testing/playwright`
// through `require` — not `import`. The export map originally declared only an
// `import` condition, so that spec died on `ERR_PACKAGE_PATH_NOT_EXPORTED`
// before a single assertion ran (issue #33).
//
// The `require` condition points at the same `.mjs` the `import` condition
// does, which only works because Node can `require()` an ES module that has no
// top-level await. Both halves of that are load-bearing and neither is visible
// from inside this repo, so both are pinned here:
//
//   - `require.resolve` exercises Node's real export-map resolution under the
//     `require` condition, so deleting the condition fails this file rather
//     than a consumer's E2E suite.
//   - actually `require()`-ing the module proves it stays synchronous. A
//     top-level await added to `playwright.mjs` would throw
//     ERR_REQUIRE_ASYNC_MODULE and silently re-break the documented `.ts` form.
//
// Both use a *self-referencing* specifier (`@elirobinson/ai-patterns/...`),
// which Node resolves against this package's own `exports` — the same code path
// a consumer's `node_modules` takes, with no install needed.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const SUBPATH = '@elirobinson/ai-patterns/testing/playwright';
const modulePath = fileURLToPath(new URL('./playwright.mjs', import.meta.url));

describe('testing/playwright resolves from CommonJS', () => {
  it('resolves the subpath under the require condition', () => {
    let resolved;
    try {
      resolved = require.resolve(SUBPATH);
    } catch (error) {
      throw new Error(
        `require.resolve('${SUBPATH}') failed with ${error.code} — a CommonJS ` +
          'Playwright spec (any plain `.ts` file) cannot import the contract ' +
          'helpers. The `require` condition is missing from the export map.',
        { cause: error },
      );
    }

    expect(resolved, 'the require condition points somewhere unexpected').toBe(modulePath);
  });

  it('requires the module without hitting ERR_REQUIRE_ASYNC_MODULE', async () => {
    const required = require(SUBPATH);
    const imported = await import('./playwright.mjs');

    expect(
      typeof required.expectDesignSystemContracts,
      'expectDesignSystemContracts is not callable when required from CJS',
    ).toBe('function');

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
