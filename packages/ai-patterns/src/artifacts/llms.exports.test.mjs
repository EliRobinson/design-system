// `@elirobinson/ai-patterns/corpus` is the llms.txt / llms-full.txt generator a
// consumer calls to render its own corpus from its own manifest. The caller
// that does that is a build script, and a build script in a `"type":
// "commonjs"` repo is a plain `.js` file — it reaches this subpath through
// `require`. The export map originally declared only an `import` condition, so
// that script died on `ERR_PACKAGE_PATH_NOT_EXPORTED` at resolution, before
// `llmsIndex` was ever called. Same latent bug as `testing/playwright` (#33),
// found while fixing it.
//
// The `require` condition points at the same `.mjs` the `import` condition
// does, which only works because Node can `require()` an ES module that has no
// top-level await. Both halves of that are load-bearing and neither is visible
// from inside this repo — apps/docs imports it as ESM — so both are pinned
// here:
//
//   - `require.resolve` exercises Node's real export-map resolution under the
//     `require` condition, so deleting the condition fails this file rather
//     than a consumer's build.
//   - actually `require()`-ing the module proves it stays synchronous. Today
//     `llms.mjs` imports nothing at all, so there is no dependency graph that
//     could hide a top-level await; the day it grows one, an async module
//     anywhere beneath it throws ERR_REQUIRE_ASYNC_MODULE and re-breaks CJS
//     callers. That is the regression this catches.
//
// Both use a *self-referencing* specifier (`@elirobinson/ai-patterns/...`),
// which Node resolves against this package's own `exports` — the same code path
// a consumer's `node_modules` takes, with no install needed.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const SUBPATH = '@elirobinson/ai-patterns/corpus';
const modulePath = fileURLToPath(new URL('./llms.mjs', import.meta.url));

describe('corpus resolves from CommonJS', () => {
  it('resolves the subpath under the require condition', () => {
    let resolved;
    try {
      resolved = require.resolve(SUBPATH);
    } catch (error) {
      throw new Error(
        `require.resolve('${SUBPATH}') failed with ${error.code} — a CommonJS ` +
          'build script cannot reach the corpus generator. The `require` ' +
          'condition is missing from the export map.',
        { cause: error },
      );
    }

    expect(resolved, 'the require condition points somewhere unexpected').toBe(modulePath);
  });

  it('requires the module without hitting ERR_REQUIRE_ASYNC_MODULE', async () => {
    const required = require(SUBPATH);
    const imported = await import('./llms.mjs');

    expect(typeof required.llmsIndex, 'llmsIndex is not callable when required from CJS').toBe(
      'function',
    );
    expect(typeof required.llmsFull, 'llmsFull is not callable when required from CJS').toBe(
      'function',
    );

    // The two conditions deliberately resolve to the same file; a future CJS
    // build must keep the export surface identical or consumers get a
    // dual-package split depending on how their build script was written.
    expect(Object.keys(required).sort()).toEqual(
      Object.keys(imported)
        .filter((name) => name !== 'default')
        .sort(),
    );
  });
});
