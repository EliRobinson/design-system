/* The worked examples the AI pages embed, read off disk at build time.

   Same bargain as DemoBlock: the code a reader copies is a real file that the
   repo compiles, so it cannot drift from the packages it imports. These files
   are never imported by a page — they exist to be typechecked and shown — and
   `pnpm typecheck` is what makes that worth anything. An example that stops
   compiling against the published types is a red build, not a page that quietly
   teaches the wrong API.

   Two roots, because two of the examples were already written and belong to the
   package that owns their API:

   - `ai-patterns` — `packages/ai-patterns/docs/examples`, the server routes.
     Read across the workspace the same way published-packages.ts reads the
     package manifests; cwd is apps/docs under `next build` and vitest alike.
   - `docs` — the client halves, which need the vendored components and the AI
     SDK's React bindings. They live here because that is where those
     dependencies are declared. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = {
  'ai-patterns': '../../packages/ai-patterns/docs/examples',
  docs: 'src/examples/ai-elements',
} as const;

export type ExampleRoot = keyof typeof ROOTS;

/** Every example the pages embed, so a test can walk them all. */
export const EXAMPLES = [
  { root: 'ai-patterns', file: 'chat-route.ts' },
  { root: 'ai-patterns', file: 'decision-route.ts' },
  { root: 'ai-patterns', file: 'tool-route.ts' },
  { root: 'docs', file: 'chat-client.tsx' },
  { root: 'docs', file: 'tool-panel.tsx' },
  { root: 'docs', file: 'decision-client.tsx' },
] as const satisfies readonly { root: ExampleRoot; file: string }[];

export type Example = (typeof EXAMPLES)[number];

export function examplePath(root: ExampleRoot, file: string): string {
  return join(process.cwd(), ROOTS[root], file);
}

/** The file's own bytes, minus the `'use client'` line — which is a framework
    instruction about where the module runs, not part of the lesson, and is
    stated in the prose beside every client example instead. */
export function readExample(root: ExampleRoot, file: string): string {
  return readFileSync(examplePath(root, file), 'utf8')
    .replace(/^'use client';\n\n?/, '')
    .trimEnd();
}
