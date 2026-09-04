// The server modules are plain JavaScript typed by hand-written `.d.ts`
// siblings — the arrangement `testing/` uses, with the same hazard: nothing in
// the build cross-checks the two, so a rename or a new export can leave the
// declarations describing a module that no longer exists. That lie is invisible
// here and surfaces as a compile error inside a consumer's route handler.
//
// Same comparison visual.types.test.mjs makes, in both directions, over every
// module the `./server…` subpaths publish.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as prompt from './prompt.mjs';
import * as stream from './stream.mjs';
import * as decisionCard from './surfaces/decision-card.mjs';
import * as stubCard from './surfaces/stub-card.mjs';
import * as verdictBadge from './surfaces/verdict-badge.mjs';
import * as tools from './tools.mjs';

const MODULES = [
  { name: 'stream', runtime: stream, declarations: 'stream.d.ts' },
  { name: 'prompt', runtime: prompt, declarations: 'prompt.d.ts' },
  { name: 'tools', runtime: tools, declarations: 'tools.d.ts' },
  { name: 'decision-card', runtime: decisionCard, declarations: 'surfaces/decision-card.d.ts' },
  { name: 'verdict-badge', runtime: verdictBadge, declarations: 'surfaces/verdict-badge.d.ts' },
  { name: 'stub-card', runtime: stubCard, declarations: 'surfaces/stub-card.d.ts' },
];

/* Comments come out first so a usage example inside one can never be read as a
   declaration. `export interface` / `export type` are erased at compile time and
   have no runtime counterpart to drift from, so only value declarations count. */
function declaredValues(fileName) {
  const source = readFileSync(fileURLToPath(new URL(`./${fileName}`, import.meta.url)), 'utf8');
  const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

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
    expect(declared.size, 'no `export declare` found — the parser above is broken').toBeGreaterThan(
      0,
    );
    expect(exported.length, 'the module exported nothing').toBeGreaterThan(0);
  });

  it('declares every value the module exports at runtime', () => {
    const undeclared = exported.filter((name) => !declared.has(name));

    expect(
      undeclared,
      `undeclared in ${declarations}: ${undeclared.join(', ')} — consumers get no types for it`,
    ).toEqual([]);
  });

  it('declares nothing the module does not actually export', () => {
    const phantom = [...declared.keys()].filter((name) => !exported.includes(name));

    expect(
      phantom,
      `declared in ${declarations}, not exported at runtime: ${phantom.join(', ')} — importing ` +
        'it type-checks and then crashes',
    ).toEqual([]);
  });

  it('backs every declared function with a callable runtime value', () => {
    const notCallable = [...declared]
      .filter(([name, kind]) => kind === 'function' && exported.includes(name))
      .filter(([name]) => typeof runtime[name] !== 'function')
      .map(([name]) => name);

    expect(notCallable, `declared as functions, not callable: ${notCallable.join(', ')}`).toEqual(
      [],
    );
  });
});
