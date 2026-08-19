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
 * Two output roots, both of them written every run:
 *
 *   dist/design-project/   the push bundle, laid out with the project-relative
 *                          paths the uploader writes to, plus a
 *                          `.push-plan.json` naming the target and the exact
 *                          write boundary — so the push is mechanical and the
 *                          target is not re-derived (and mis-derived) by hand.
 *   design-system-docs/    the repo's own working copies of the two artifacts
 *                          that both sides need: `styles.css` and the generated
 *                          `guidelines/` cards.
 *
 * Content generation lives in ../src/artifacts/*. This file is orchestration:
 * read the inputs, hand them to a builder, decide where the bytes land.
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
import { TOKEN_STYLESHEETS, readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';

import { buildAdherenceConfig } from '../src/artifacts/adherence.mjs';
import { replaceManagedBlock, visualArtifactsGuidance } from '../src/artifacts/brand.mjs';
import {
  buildDocsStylesheet,
  buildProvenanceDoc,
  pushBoundary,
  toPosix,
} from '../src/artifacts/design-project.mjs';
import { buildGuidelineCards } from '../src/artifacts/guideline-cards.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(packageDir, '..', '..');
const outDir = join(packageDir, 'dist', 'design-project');
const docsDir = join(repoRoot, 'design-system-docs');

/* Component stylesheets are copied verbatim: the project renders real DS CSS,
   which is the whole reason its previews look like the product. One rename —
   the project has no nested directories under components/. */
const STYLESHEET_RENAMES = { 'organisms/table/core.css': 'organisms/table-core.css' };

const TOKENS_SRC = join(repoRoot, 'packages/tokens/src');

/* The token stylesheets the bundle carries, under `tokens/`.
 *
 * `TOKEN_STYLESHEETS` is the *parse* roster — the files that declare a default
 * token value — and mobile.css is deliberately not on it because it declares
 * no name of its own. It still has to be copied: tokens.css `@import`s both
 * siblings with relative specifiers, so a bundle holding tokens.css alone is a
 * stylesheet with two dangling imports, and the mirrored project renders with
 * no colour at all while every file in it looks present.
 *
 * Copy set = the roster plus the platform layer, derived rather than listed, so
 * a palette file added to the tokens package lands here without an edit. */
const BUNDLED_TOKEN_STYLESHEETS = [...TOKEN_STYLESHEETS, 'mobile.css'];

/* Components that exist only in the design project, with no counterpart in
   @elirobinson/react. They are legal to use inside it and belong in the
   adherence roster — otherwise the "unknown component" rule flags the
   project's own work. Promote any of these into the package and it should be
   deleted from here in the same change; `ChatMessage` and `ChatThread` left
   this list when the `ai/` tier was added to the package, which is what that
   sentence means in practice. */
const PROJECT_OWNED_COMPONENTS = ['ChatComposer', 'PromptSuggestions'];

/* The Claude Design project these files belong to, and the fixed part of the
   only paths a push built from this output may touch. The generated foundation
   cards are added to `writes` at build time from what the card builder actually
   emits — see `pushBoundary` — because a hand-listed copy of that roster is the
   same restatement bug this whole pipeline exists to remove. */
const TARGET = {
  projectId: 'e160cbb7-83c8-4cf0-81d3-a358e70bc838',
  name: 'Miltinson Design System',
  repo: 'EliRobinson/design-system',
  branch: 'main',
  writes: [
    '_adherence.oxlintrc.json',
    'SKILL.md',
    'github.md',
    ...BUNDLED_TOKEN_STYLESHEETS.map((name) => `tokens/${name}`),
    'components/atoms/*.css',
    'components/molecules/*.css',
    'components/organisms/*.css',
    'components/ai/*.css',
  ],
  deletes: [],
};

function write(relativePath, contents) {
  const destination = join(outDir, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function writeDocs(relativePath, contents) {
  const destination = join(docsDir, relativePath);
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

/* Kit directories, ignoring `_shared` and friends. Absent is a real answer, not
   an error: `_project-mirror/` is explicitly meant to be emptied as kits get
   ported into the shippable `ui_kits/`, and the provenance note is not worth
   failing a build over. */
function countKitDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith('_'),
    ).length;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

function main() {
  const require = createRequire(import.meta.url);
  const manifest = JSON.parse(readFileSync(require.resolve('@elirobinson/react/manifest'), 'utf8'));
  /* Every token stylesheet, in cascade order. tokens.css alone parses and
     yields a few hundred declarations with the entire brand missing, so the
     adherence config would ship a token roster that has no `--accent*` in it
     and nothing would fail. */
  const tokens = parseTokensCss(readTokenStylesheets(TOKENS_SRC));

  if (!manifest.components?.length) {
    throw new Error('@elirobinson/react/manifest describes no components. Build that package.');
  }
  if (tokens.length === 0) {
    throw new Error(
      `No tokens parsed from ${TOKEN_STYLESHEETS.join(' + ')} in packages/tokens/src.`,
    );
  }

  rmSync(outDir, { recursive: true, force: true });

  /* 1. Tokens — the project's copies are the repo's files, not restatements.
        All three layers, because tokens.css @imports the other two. */
  for (const name of BUNDLED_TOKEN_STYLESHEETS) {
    write(`tokens/${name}`, readFileSync(join(TOKENS_SRC, name), 'utf8'));
  }

  /* 2. Component stylesheets. */
  const componentsRoot = join(repoRoot, 'packages/react/src/components');
  const sheets = stylesheets(componentsRoot);
  for (const sheet of sheets) {
    copy(
      join(componentsRoot, sheet),
      join('components', STYLESHEET_RENAMES[toPosix(sheet)] ?? sheet),
    );
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

  /* 4. The aggregate stylesheet the repo's mirrored guideline cards link to. */
  writeDocs('styles.css', buildDocsStylesheet(sheets));

  /* 5. The foundation cards that are pure token enumerations, to both sides.
        The editorial cards in guidelines/ are the project's and are not touched
        — this only ever writes the paths buildGuidelineCards names. */
  const cards = buildGuidelineCards(tokens);
  for (const { path, html } of cards) {
    writeDocs(join('guidelines', path), html);
    write(join('guidelines', path), html);
  }

  /* 6. SKILL.md — the project's copy of the brand skill. The hand-written copy
        had lost every brand rule that makes the skill worth invoking ("Eli
        speaks as 'I' — never 'we'", the tagline, the accessibility floors).
        Generated through the same managed-block mechanism the consumer skill
        uses, so those rules are carried verbatim from one source and only the
        surface-specific paragraphs differ. */
  write(
    'SKILL.md',
    replaceManagedBlock(
      readFileSync(join(docsDir, 'SKILL.md'), 'utf8'),
      [
        'Read `readme.md` first, then explore `guidelines/`, `ui_kits/`, `patterns/`,',
        '`slides/` and `assets/`.',
        '',
        '**The JSX under `components/` is not the component library.** Those files are',
        'cosmetic recreations for prototyping: they deliberately skip focus trapping,',
        'virtualization and table logic, and their prop surface is flat where the real one',
        'is compound. For production code install `@elirobinson/react` and',
        '`@elirobinson/tokens` from the source repo, and check a prop against',
        '`_adherence.oxlintrc.json` (generated from the published component manifest) rather',
        'than against the JSX here.',
        '',
        visualArtifactsGuidance({ stylesheet: 'styles.css', readme: 'readme.md' }),
      ].join('\n'),
      'design-system-docs/SKILL.md',
    ),
  );

  /* 7. github.md — the project's record of where it came from. */
  write(
    'github.md',
    buildProvenanceDoc({
      target: TARGET,
      manifest,
      stylesheetCount: sheets.length,
      tokenCount: tokens.length,
      cardCount: cards.length,
      kits: {
        shared: countKitDirs(join(docsDir, 'ui_kits')),
        projectOnly: countKitDirs(join(docsDir, '_project-mirror', 'ui_kits')),
      },
    }),
  );

  /* 8. The push plan, so the target and the write boundary travel with the
        bundle rather than being remembered. */
  write(
    '.push-plan.json',
    `${JSON.stringify(
      {
        $comment: 'Generated by scripts/build-design-project.mjs — do not edit by hand.',
        ...pushBoundary(TARGET, cards),
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
