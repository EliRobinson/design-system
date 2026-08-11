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

/* Comments come out first so a usage example inside one can never be read as a
   declaration. The line-comment pass deliberately strips only from `//` to the
   end of the line, not the whole line: `export declare const X: string; // note`
   is a declaration with a comment on it, and deleting the line would drop X and
   report it as drift. */
const declarationBody = declarationSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

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
      `exported by playwright.mjs, undeclared in playwright.d.ts: ${undeclared.join(', ')} — consumers get no types for it`,
    ).toEqual([]);
  });

  it('declares nothing the module does not actually export', () => {
    const phantom = [...declaredValues.keys()].filter((name) => !runtimeExports.includes(name));

    expect(
      phantom,
      `declared in playwright.d.ts, not exported by playwright.mjs: ${phantom.join(', ')} — importing it type-checks and then crashes at runtime`,
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
        ([name]) =>
          `${name}: declared a function, runtime value is a ${typeof runtimeModule[name]}`,
      );

    expect(notCallable, notCallable.join('; ')).toEqual([]);
  });
});
