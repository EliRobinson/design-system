#!/usr/bin/env node
/* Stages the files the repo owns inside a Claude Design project.
 *
 * The split is deliberate and one-directional per file. The repo is the source
 * for tokens, component stylesheets and the component API; the design project
 * is the source for guidelines, ui_kits, templates, slides and patterns. This
 * script emits only the first set, so a push built from it can never clobber
 * the design work — the thing that makes the Storybook-shaped `.design-sync`
 * pipeline the wrong tool for this project.
 *
 * Output lands in `dist/design-project/`, laid out with the project-relative
 * paths the uploader writes to, alongside a `.push-plan.json` naming the target
 * project and the exact write globs — so the push is a mechanical step and the
 * target is not re-derived (and mis-derived) by hand each time.
 *
 * Note this is NOT `.design-sync/`. That pipeline converts Storybook into a
 * flat generated bundle and targets a different project; pointing it at this
 * one would overwrite the guidelines, ui_kits, templates and slides that only
 * exist there.
 */

import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';

import { buildAdherenceConfig } from '../src/artifacts/adherence.mjs';
import { buildGuidelineCards } from '../src/artifacts/guideline-cards.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(packageDir, '..', '..');
const outDir = join(packageDir, 'dist', 'design-project');

/* Component stylesheets are copied verbatim: the project renders real DS CSS,
   which is the whole reason its previews look like the product. One rename —
   the project has no nested directories under components/. */
const STYLESHEET_RENAMES = { 'organisms/table/core.css': 'organisms/table-core.css' };

/* The project's `ai/` tier has no counterpart in @elirobinson/react. Those
   components are the project's own, so they are legal to use inside it and
   belong in the adherence roster — otherwise the "unknown component" rule
   flags the project's own work. Promote any of these into the package and it
   should be deleted from here in the same change. */
const PROJECT_OWNED_COMPONENTS = ['ChatComposer', 'ChatMessage', 'ChatThread', 'PromptSuggestions'];

/* The Claude Design project these files belong to, and the only paths a push
   built from this output may touch. The globs are the boundary that keeps a
   push on the repo's side of the split — everything else in the project is
   design work the repo does not own and must never write. */
const TARGET = {
  projectId: 'e160cbb7-83c8-4cf0-81d3-a358e70bc838',
  name: 'Miltinson Design System',
  writes: [
    '_adherence.oxlintrc.json',
    'tokens/tokens.css',
    'components/atoms/*.css',
    'components/molecules/*.css',
    'components/organisms/*.css',
    /* Only the generated foundation cards. The editorial cards in guidelines/
       are the project's own and must stay outside the write boundary. */
    'guidelines/colors-ink.html',
    'guidelines/colors-signal.html',
    'guidelines/colors-anchor.html',
    'guidelines/colors-status.html',
    'guidelines/colors-surfaces.html',
    'guidelines/colors-text.html',
    'guidelines/radii.html',
    'guidelines/shadows.html',
    'guidelines/spacing-scale.html',
    'guidelines/type-weights.html',
    'guidelines/motion.html',
  ],
  deletes: [],
};

function write(relativePath, contents) {
  const destination = join(outDir, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function copy(from, relativePath) {
  const destination = join(outDir, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(from, destination);
}

/** Every `<Name>.css` under src/components, as paths relative to that root. */
function stylesheets(root) {
  const found = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.css')) found.push(relative(root, path));
    }
  })(root);
  return found.sort();
}

function main() {
  const require = createRequire(import.meta.url);
  const manifest = JSON.parse(readFileSync(require.resolve('@elirobinson/react/manifest'), 'utf8'));
  const tokensCss = readFileSync(join(repoRoot, 'packages/tokens/src/tokens.css'), 'utf8');
  const tokens = parseTokensCss(tokensCss);

  if (!manifest.components?.length) {
    throw new Error('@elirobinson/react/manifest describes no components. Build that package.');
  }
  if (tokens.length === 0) {
    throw new Error('No tokens parsed from packages/tokens/src/tokens.css.');
  }

  rmSync(outDir, { recursive: true, force: true });

  /* 1. Tokens — the project's copy is the repo's file, not a restatement. */
  write('tokens/tokens.css', tokensCss);

  /* 2. Component stylesheets. */
  const componentsRoot = join(repoRoot, 'packages/react/src/components');
  const sheets = stylesheets(componentsRoot);
  for (const sheet of sheets) {
    const key = sheet.split(/[\\/]/).join('/');
    copy(join(componentsRoot, sheet), join('components', STYLESHEET_RENAMES[key] ?? key));
  }

  /* 3. The adherence config — the API contract the project enforces while an
        agent writes code. Generated, because a hand-written copy drifts. */
  write(
    '_adherence.oxlintrc.json',
    `${JSON.stringify(
      buildAdherenceConfig({ manifest, tokens, projectOwned: PROJECT_OWNED_COMPONENTS }),
      null,
      2,
    )}\n`,
  );

  /* 4. design-system-docs/styles.css — the aggregate the mirrored guideline
        cards link to. Written into the repo rather than into dist/ because it
        is a working file for those cards, and generated rather than checked in
        because it is a list of 41 stylesheet paths that drifts the moment a
        component is added. Paths are relative so a card opens from the file
        system with no server. */
  const docsStyles = [
    '/* GENERATED by packages/ai-patterns/scripts/build-design-project.mjs.',
    '   Do not edit by hand — run `pnpm -F @elirobinson/ai-patterns build:design-project`.',
    '   The aggregate the guidelines/ cards link to, pointing at the real',
    '   component stylesheets rather than a copy of them. */',
    "@import './colors_and_type.css';",
    ...sheets.map(
      (sheet) => `@import '../packages/react/src/components/${sheet.split(/[\\/]/).join('/')}';`,
    ),
    '',
  ].join('\n');
  writeFileSync(join(repoRoot, 'design-system-docs', 'styles.css'), docsStyles);

  /* 5. The foundation cards that are pure token enumerations. Written to both
        sides: into design-system-docs/guidelines/ for the repo, and staged for
        the push so the project stops carrying a hand-copy of the scale. The
        editorial cards in that directory are the project's and are not touched
        — this only ever writes the paths buildGuidelineCards names. */
  const cards = buildGuidelineCards(tokens);
  const docsGuidelines = join(repoRoot, 'design-system-docs', 'guidelines');
  mkdirSync(docsGuidelines, { recursive: true });
  for (const { path, html } of cards) {
    writeFileSync(join(docsGuidelines, path), html);
    write(join('guidelines', path), html);
  }

  /* 6. The push plan. Emitted rather than remembered, so the target project and
        the write boundary travel with the bundle. */
  write(
    '.push-plan.json',
    `${JSON.stringify(
      {
        $comment: 'Generated by scripts/build-design-project.mjs — do not edit by hand.',
        ...TARGET,
        source: `${manifest.package}@${manifest.version}`,
      },
      null,
      2,
    )}\n`,
  );

  process.stdout.write(
    `design-project: ${sheets.length} stylesheets, ${tokens.length} tokens, ` +
      `${manifest.components.length} components (${manifest.package}@${manifest.version}) -> ` +
      `${relative(repoRoot, outDir)}\n` +
      `  push target: ${TARGET.name} (${TARGET.projectId})\n`,
  );
}

main();
