/* The UI kit samples ship into a consuming repo's `.claude/skills/` — a
 * directory most projects lint — so they have to survive a consumer's ESLint,
 * not just the browser preview they were written for (#119).
 *
 * They are loaded as classic `<script type="text/babel">` tags sharing one
 * global scope, with `_shared/Primitives.jsx` defining the components the
 * other kits use. That is correct for the preview and indistinguishable, to a
 * linter, from a module with missing imports.
 *
 * This lints the real shipped files with the real rule rather than asserting
 * that some magic comment is present: a header that stops matching the rule it
 * suppresses would still pass a substring check, and the point is the errors,
 * not the text.
 */

import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import { ESLint } from 'eslint';
import react from 'eslint-plugin-react';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const kitsRoot = join(repoRoot, 'design-system-docs/ui_kits');

/* `.js` as well as `.jsx`: `_shared/content.js` is a kit file like any other — it ships
   into the same `.claude/skills/` directory and a consumer's ESLint reads it the same
   way. Scanning only `.jsx` would have left it the one unlinted file in the tree, which
   is the hole #119 was about. */
function everyScript(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...everyScript(path));
    else if (/\.jsx?$/.test(entry.name)) found.push(path);
  }
  return found.sort();
}

/* A stand-in for a typical consumer: eslint-plugin-react's rule over .jsx.
   `overrideConfigFile: true` keeps this repo's own eslint.config.mjs out of
   it — the consumer's config is the thing being simulated, not ours. */
const eslint = new ESLint({
  /* Anchored at the repo root, not the package. `files` globs resolve against
     cwd, so with the default cwd (packages/ai-patterns) the kit files matched
     no config object and ESLint skipped them — reporting zero errors over a
     tree that was full of them. This test passed before the fix until that was
     corrected, which is the whole reason for the "actually linted" assertion
     below. */
  cwd: repoRoot,
  overrideConfigFile: true,
  overrideConfig: [
    js.configs.recommended,
    /* An unused directive is an error too. Adding a blanket header to a kit
       that does not need one would trip this, which is why only the kits that
       actually reference the shared primitives carry one. */
    { linterOptions: { reportUnusedDisableDirectives: 'error' } },
    {
      files: ['**/*.jsx'],
      plugins: { react },
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      settings: { react: { version: '18.3.1' } },
      rules: { 'react/jsx-no-undef': 'error' },
    },
  ],
});

describe('shipped UI kit samples (#119)', () => {
  it('finds the kits, so a rename cannot make this vacuous', () => {
    expect(everyScript(kitsRoot).length).toBeGreaterThan(0);
  });

  /* The guard that makes the assertion below mean anything. A file ESLint
     declines to lint reports no errors, which is indistinguishable from a
     clean one — so prove every kit was actually processed. */
  it('actually lints every kit, rather than skipping them as unmatched', async () => {
    const files = everyScript(kitsRoot);
    const results = await eslint.lintFiles(files);

    expect(results).toHaveLength(files.length);
    const skipped = results
      .filter((result) =>
        result.messages.some((m) => /ignored|no matching config/i.test(m.message)),
      )
      .map((result) => relative(repoRoot, result.filePath));
    expect(skipped).toEqual([]);
  });

  /* Every error, not just react/jsx-no-undef. The consumer reported "~20"
     errors; the split is 16 jsx-no-undef plus 5 no-undef on `window`, and a
     fix that cleared only the first would still leave a red lint run in the
     directory ds-resync writes to. */
  it('reports no lint errors at all under a consumer-style config', async () => {
    const results = await eslint.lintFiles(everyScript(kitsRoot));

    const offences = results.flatMap((result) =>
      result.messages.map(
        (message) =>
          `${relative(repoRoot, result.filePath)}:${message.line} ${message.ruleId}: ${message.message}`,
      ),
    );

    expect(offences).toEqual([]);
  });
});
