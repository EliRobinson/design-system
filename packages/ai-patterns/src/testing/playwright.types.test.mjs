// `playwright.mjs` is plain JavaScript, and `playwright.d.ts` is the hand-written
// type surface published alongside it (`@elirobinson/ai-patterns/testing/playwright`
// declares both `types` and `import`). Nothing in the build cross-checks the two,
// so a rename or a new helper can leave the declarations describing a module that
// no longer exists — a lie that stays invisible here and only surfaces as a
// compile error inside a consumer's test suite.
//
// This compares the module's real runtime exports against the declarations parsed
// out of the .d.ts, in both directions.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as runtimeModule from './playwright.mjs';

const declarationSource = readFileSync(
  fileURLToPath(new URL('./playwright.d.ts', import.meta.url)),
  'utf8',
);

/* Comments come out first so a usage example inside a JSDoc block can never be
   read as a declaration. */
const declarationBody = declarationSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[^\n]*\/\/.*$/gm, '');

/* Only value declarations matter. `export interface` / `export type` are erased
   at compile time and have no runtime counterpart to drift from. */
const declaredValues = new Map(
  [...declarationBody.matchAll(/^export declare (const|function|class|let|var) (\w+)/gm)].map(
    (match) => [match[2], match[1]],
  ),
);

const runtimeExports = Object.keys(runtimeModule);

describe('playwright.d.ts matches playwright.mjs', () => {
  it('parsed declarations out of the .d.ts at all', () => {
    // Without this, a regex that stops matching would make every other
    // assertion below pass vacuously.
    expect(
      declaredValues.size,
      'no `export declare` found — the parser above is broken',
    ).toBeGreaterThan(0);
    expect(runtimeExports.length, 'playwright.mjs exported nothing').toBeGreaterThan(0);
  });

  it('declares every value the module exports at runtime', () => {
    const undeclared = runtimeExports.filter((name) => !declaredValues.has(name));

    expect(
      undeclared,
      `playwright.mjs exports ${undeclared.join(', ')} but playwright.d.ts does not declare ${
        undeclared.length === 1 ? 'it' : 'them'
      } — consumers get no types for that export`,
    ).toEqual([]);
  });

  it('declares nothing the module does not actually export', () => {
    const phantom = [...declaredValues.keys()].filter((name) => !runtimeExports.includes(name));

    expect(
      phantom,
      `playwright.d.ts declares ${phantom.join(', ')} but playwright.mjs does not export ${
        phantom.length === 1 ? 'it' : 'them'
      } — importing that name type-checks and then crashes at runtime`,
    ).toEqual([]);
  });

  /* Only checked in one direction: `export declare function foo` promises a
     callable, so a non-callable runtime value is a lie. The reverse is not —
     `export declare const foo: () => void` is a perfectly good way to type a
     function-valued const. */
  it('backs every declared function with a callable runtime value', () => {
    const notCallable = [...declaredValues]
      .filter(([name, kind]) => kind === 'function' && runtimeExports.includes(name))
      .filter(([name]) => typeof runtimeModule[name] !== 'function')
      .map(
        (entry) =>
          `${entry[0]}: declared as a function, runtime value is a ${typeof runtimeModule[entry[0]]}`,
      );

    expect(notCallable, notCallable.join('; ')).toEqual([]);
  });
});
