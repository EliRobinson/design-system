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
import { replaceManagedBlock } from '../src/artifacts/brand.mjs';
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
  repo: 'EliRobinson/design-system',
  branch: 'main',
  writes: [
    '_adherence.oxlintrc.json',
    'SKILL.md',
    'github.md',
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

  /* 6. SKILL.md — the project's copy of the brand skill.
        The project's hand-written copy had lost every brand rule that makes the
        skill worth invoking: "Eli speaks as 'I' — never 'we'", the tagline, the
        Kids Recipes emoji exception, the accessibility floors. Generated from
        design-system-docs/SKILL.md through the same managed-block mechanism the
        consumer skill uses, so the brand rules below the block are carried
        verbatim and only the repo-specific paragraph is swapped. */
  const skillSource = readFileSync(join(repoRoot, 'design-system-docs', 'SKILL.md'), 'utf8');

  /* The prose below the managed block names files by their repo path, and two of
     them are spelled differently in the project: the tokens stylesheet is
     `styles.css` there (`colors_and_type.css` is the repo's symlink), and the
     readme is lowercase. Fixed here rather than by widening the managed block,
     because that block's current text is correct for the repo and for the
     consumer skill — the project is the only surface that needs the rename. */
  const forProject = (text) =>
    text.replaceAll('`colors_and_type.css`', '`styles.css`').replaceAll('README.md', 'readme.md');

  write(
    'SKILL.md',
    forProject(
      replaceManagedBlock(
        skillSource,
        [
          'Read `readme.md` first, then explore `guidelines/`, `ui_kits/`, `templates/`,',
          '`patterns/`, `slides/` and `assets/`.',
          '',
          '**The JSX under `components/` is not the component library.** Those files are',
          'cosmetic recreations for prototyping: they deliberately skip focus trapping,',
          'virtualization and table logic, and their prop surface is flat where the real one',
          'is compound. For production code install `@elirobinson/react` and',
          '`@elirobinson/tokens` from the source repo, and check a prop against',
          '`_adherence.oxlintrc.json` (generated from the published component manifest) rather',
          'than against the JSX here.',
        ].join('\n'),
        'design-system-docs/SKILL.md',
      ),
    ),
  );

  /* 7. github.md — the project's record of where it came from. The hand-written
        copy claimed five ui kits while the project carried thirteen, so the
        project's own account of itself was wrong. Counted, not asserted. */
  const kitCount = readdirSync(join(repoRoot, 'design-system-docs', '_project-mirror', 'ui_kits'), {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory()).length;
  const originalKits = readdirSync(join(repoRoot, 'design-system-docs', 'ui_kits'), {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('_')).length;

  write(
    'github.md',
    [
      `repo: ${TARGET.repo}`,
      `branch: ${TARGET.branch}`,
      '',
      '## Ownership',
      '',
      'Split by content type, one direction per file. Nothing here is edited by hand on',
      'both sides.',
      '',
      '| Owned by the repo (pushed here) | Owned by this project (pulled to the repo) |',
      '| --- | --- |',
      '| `tokens/tokens.css` | `guidelines/` editorial cards |',
      '| `components/**/*.css` | `ui_kits/`, `templates/`, `patterns/`, `slides/` |',
      '| `_adherence.oxlintrc.json` | `components/**/*.jsx` prototyping recreations |',
      '| `guidelines/` token cards | |',
      '| `SKILL.md`, `github.md` | |',
      '',
      '## Generated, not written',
      '',
      `- \`_adherence.oxlintrc.json\` — from \`${manifest.package}@${manifest.version}\`'s component`,
      '  manifest. Every rule, including the roster of exported component names.',
      '- `guidelines/` token cards — from `tokens.css`. A swatch card is a restatement of',
      '  the token scale, and a hand-written one drifts: the copy these replaced rendered',
      '  10 of the 13 ink steps.',
      '- `tokens/tokens.css` and every component stylesheet — copied verbatim from source.',
      '- `SKILL.md` and this file.',
      '',
      'Regenerate and push with `pnpm -F @elirobinson/ai-patterns build:design-project`,',
      'then write the paths named in `.push-plan.json`.',
      '',
      '## Counts',
      '',
      `- ${manifest.components.length} components in the published library`,
      `- ${sheets.length} component stylesheets, mirrored 1:1`,
      `- ${tokens.length} design tokens`,
      `- ${cards.length} generated foundation cards`,
      `- ${kitCount + originalKits} ui kits in this project — ${originalKits} that also ship from the`,
      `  repo's \`ui_kits/\`, and ${kitCount} that exist only here (mirrored into the repo under`,
      '  `design-system-docs/_project-mirror/`, which does not ship)',
      '',
    ].join('\n'),
  );

  /* 8. The push plan. Emitted rather than remembered, so the target project and
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
