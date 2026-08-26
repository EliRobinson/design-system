/* The prompt templates that ship in @elirobinson/ai-patterns, read out of the
   installed package at build time so the page can never drift from the file a
   consumer actually gets.

   Two things live here rather than in the component so they are reachable from
   a node-environment test: the reader, whose return value is the copy payload,
   and the remark plugin set the renderer runs. The docs page renders this
   markdown *and* offers it for copying — those must be the same string, or the
   copy button starts handing agents prose instead of a prompt. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import remarkGfm from 'remark-gfm';

/* Every template the page embeds. Kept here so the test can walk them all
   instead of re-listing the filenames it happens to know about. */
export const PROMPT_FILES = ['add-component.md', 'adopt-system.md', 'audit-page.md'] as const;

export type PromptFile = (typeof PROMPT_FILES)[number];

/* Task lists (`- [ ] …`) are GFM, not CommonMark, and the verification
   checklist at the foot of every template is nothing but task lists — without
   this they render as bullets with a literal "[ ]" in them. Nothing else in
   the templates needs GFM today (no tables, no strikethrough, no bare
   autolinks), so this is the whole extension surface. */
export const promptRemarkPlugins = [remarkGfm];

/* Same symlink-path trick as tokens-css.ts: the specifier is assembled at
   runtime so the bundler never sees a resolvable module path for a non-JS
   asset. cwd is apps/docs under both `next build` and vitest. */
export function readPromptSource(file: string): string {
  return readFileSync(
    join(process.cwd(), 'node_modules/@elirobinson/ai-patterns/src/prompts', file),
    'utf8',
  ).trim();
}
