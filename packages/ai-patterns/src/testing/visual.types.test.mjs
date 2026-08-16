// The visual preset is plain JavaScript typed by hand-written `.d.ts` siblings,
// the same arrangement `testing/playwright` uses and with the same hazard:
// nothing in the build cross-checks the two, so a rename or a new helper can
// leave the declarations describing a module that no longer exists — a lie that
// is invisible here and only surfaces as a compile error inside a consumer's
// config or spec.
//
// This compares each module's real runtime exports against the declarations
// parsed out of its `.d.ts`, in both directions.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as visualConfig from './visual-config.mjs';
import * as visualSweep from './visual-sweep.mjs';

const MODULES = [
  { name: 'visual-config', runtime: visualConfig, declarations: 'visual-config.d.ts' },
  { name: 'visual-sweep', runtime: visualSweep, declarations: 'visual-sweep.d.ts' },
];

/* Comments come out first so a usage example inside one can never be read as a
   declaration. The line-comment pass deliberately strips only from `//` to the
   end of the line, not the whole line: `export declare const X: string; // note`
   is a declaration with a comment on it, and deleting the line would drop X and
   report it as drift. */
function declaredValues(fileName) {
  const source = readFileSync(fileURLToPath(new URL(`./${fileName}`, import.meta.url)), 'utf8');
  const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  /* Only value declarations matter. `export interface` / `export type` are
     erased at compile time and have no runtime counterpart to drift from. */
  return new Map(
    [...body.matchAll(/^export declare (const|function|class|let|var) (\w+)/gm)].map((match) => [
      match[2],
      match[1],
    ]),
  );
}

describe.each(MODULES)('$declarations matches $name.mjs', ({ runtime, declarations }) => {
  const declared = declaredValues(declarations);
  const exported = Object.keys(runtime);

  it('parsed declarations out of the .d.ts at all', () => {
    // Without this, a regex that stops matching would make every other
    // assertion below pass vacuously.
    expect(declared.size, 'no `export declare` found — the parser above is broken').toBeGreaterThan(
      0,
    );
    expect(exported.length, 'the module exported nothing').toBeGreaterThan(0);
  });

  it('declares every value the module exports at runtime', () => {
    const undeclared = exported.filter((name) => !declared.has(name));

    expect(
      undeclared,
      `exported by ${declarations.replace('.d.ts', '.mjs')}, undeclared in ${declarations}: ${undeclared.join(', ')} — consumers get no types for it`,
    ).toEqual([]);
  });

  it('declares nothing the module does not actually export', () => {
    const phantom = [...declared.keys()].filter((name) => !exported.includes(name));

    expect(
      phantom,
      `declared in ${declarations}, not exported at runtime: ${phantom.join(', ')} — importing it type-checks and then crashes`,
    ).toEqual([]);
  });

  /* Only checked in one direction: `export declare function foo` promises a
     callable, so a non-callable runtime value is a lie. The reverse is not —
     `export declare const foo: () => void` is a perfectly good way to type a
     function-valued const. */
  it('backs every declared function with a callable runtime value', () => {
    const notCallable = [...declared]
      .filter(([name, kind]) => kind === 'function' && exported.includes(name))
      .filter(([name]) => typeof runtime[name] !== 'function')
      .map(([name]) => `${name}: declared a function, runtime value is a ${typeof runtime[name]}`);

    expect(notCallable, notCallable.join('; ')).toEqual([]);
  });
});
