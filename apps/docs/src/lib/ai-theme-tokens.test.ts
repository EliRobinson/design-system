import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import { stripComments } from './css-source';

/* #352: `.ds-ai-model-list` read --anchored-min-width, a token that now lives
   only inside DropdownMenu. Nothing declared it for the list, `var()` resolved
   to nothing, and the list lost its 180px floor with no warning.

   A rule under app/ai-theme may read a custom property only if the theme's own
   files or the global token sheets declare it. A component-local token read
   from here is the bug. */

const THEME_DIR = join(process.cwd(), 'src/app/ai-theme');

const read = (path: string) => stripComments(readFileSync(path, 'utf8'));
const themeFiles = readdirSync(THEME_DIR).filter((f) => f.endsWith('.css'));

/* Coarse on purpose: a name declared on ANY theme selector or global sheet
   counts. It catches a token no theme file declares (#352), not one declared
   on an unrelated selector, and it does not read component or font sheets. */
const declared = new Set<string>();
for (const css of [
  ...themeFiles.map((f) => read(join(THEME_DIR, f))),
  ...readTokenStylesheets().map(stripComments),
]) {
  for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1]);
}

describe('ai-theme custom properties', () => {
  it.each(themeFiles)('%s reads only declared tokens', (file) => {
    const css = read(join(THEME_DIR, file));
    /* `var(--x, fallback)` is safe by construction: it names its own floor. */
    const unguarded = [...css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]);
    const missing = [...new Set(unguarded)].filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });
});
