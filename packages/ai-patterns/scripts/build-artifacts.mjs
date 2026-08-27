#!/usr/bin/env node
/* Stages everything `ds-resync artifacts` writes into a consuming repo.
 *
 * Runs as this package's `build` and again as `prepack`, so a tarball can never
 * be produced without it. Output lands in `dist/artifacts/skills/**`, laid out
 * exactly as it will appear under a consumer's `.claude/skills/` — the writer
 * on the other end copies a tree and checks hashes, and holds no opinion about
 * what is in it. Changing the shipped set is a change to this file alone.
 *
 * Two deliberate simplifications:
 *
 * - The llms snapshot derives from `@elirobinson/react/manifest` — the same
 *   published artifact a consumer reads — so packing depends on that package
 *   being built and on nothing else. In particular it never builds `apps/docs`,
 *   which is a reader of the manifest exactly like this script is.
 * - `preview/` and `uploads/` are working material for this repo and never
 *   ship; `slides/` and `patterns/` produce Miltinson marketing collateral,
 *   which a consuming product repo has no use for. See BRAND_SOURCES.
 */

import { createHash } from 'node:crypto';
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import { TOKEN_STYLESHEETS, readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';

import { replaceManagedBlock, transformBrandDocs } from '../src/artifacts/brand.mjs';
import {
  BRAND_SOURCES,
  buildBrandManifest,
  renderRepoIndexTable,
} from '../src/artifacts/brand-manifest.mjs';
import { copyTree } from '../src/artifacts/copy-tree.mjs';
import { llmsFull, llmsIndex } from '../src/artifacts/llms.mjs';
import { referenceSkillDoc, SKILL_DIRS } from '../src/artifacts/skills.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(packageDir, '..', '..');
const outDir = join(packageDir, 'dist', 'artifacts');
const skillsDir = join(outDir, 'skills');

/* Where a reader of the packed llms.txt goes next. The docs site answers the
   same question with URLs; a consumer holding this tarball has files and a
   CLI, so this is one of the few things the two corpora cannot share. */
const SNAPSHOT_CONTENTS = {
  heading: 'The rest of this snapshot',
  entries: [
    '- `llms-full.txt` — every token, every constraint, and every component with its prop table',
    '- `pnpm ds` / `pnpm ds props <Name>` — the same information read live from the installed',
    '  package. Always authoritative; this file is a convenience for reading in bulk.',
  ],
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/* The one component inventory, resolved through @elirobinson/react's exports
   map rather than by path, so this reads exactly what a consumer would. It is a
   build output of that package: `pnpm build` orders it first because
   package.json declares the dependency. */
function componentManifest() {
  const resolve = createRequire(import.meta.url).resolve;
  try {
    return readJson(resolve('@elirobinson/react/manifest'));
  } catch (error) {
    throw new Error(
      'Cannot resolve @elirobinson/react/manifest. Build that package first: ' +
        'pnpm nx build react.',
      { cause: error },
    );
  }
}

function version(packageName) {
  return readJson(join(repoRoot, 'packages', packageName, 'package.json')).version;
}

function write(relativePath, contents) {
  const destination = join(skillsDir, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

/** Every file under `dir`, as repo-independent forward-slash relative paths. */
function walk(dir, base = dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path, base));
    else found.push(relative(base, path).split(sep).join('/'));
  }
  return found.sort();
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function main() {
  const versions = {
    aiPatterns: readJson(join(packageDir, 'package.json')).version,
    react: version('react'),
    tokens: version('tokens'),
  };

  const manifest = componentManifest();
  const contracts = readJson(join(packageDir, 'src/contracts.json'));
  /* Every token stylesheet, not tokens.css alone. The roster is the tokens
     package's to name — asking it is what keeps a fourth layer from needing an
     edit here — and reading one file is not a smaller version of reading all of
     them: tokens.css on its own parses fine and simply has no brand in it, so
     the packed llms snapshot and the brand manifest would both describe a
     greyscale system without anything failing. */
  const tokenSrcDir = join(repoRoot, 'packages/tokens/src');
  const tokens = parseTokensCss(readTokenStylesheets(tokenSrcDir));

  if (!manifest.components?.length) {
    throw new Error('@elirobinson/react/manifest describes no components.');
  }
  if (tokens.length === 0) {
    throw new Error(
      `No tokens parsed from ${TOKEN_STYLESHEETS.join(' + ')} in packages/tokens/src.`,
    );
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(skillsDir, { recursive: true });

  const brandSource = join(repoRoot, 'design-system-docs');

  /* 0. Brand manifest — the spine the docs site, the corpus, and the MCP
        server read — and the in-repo README index table generated from it.
        Regenerated before the consumer transform below reads the README, so
        both surfaces derive from the same walk. */
  const brandManifest = buildBrandManifest({ root: brandSource, tokens });
  writeFileSync(join(outDir, 'brand-manifest.json'), `${JSON.stringify(brandManifest, null, 2)}\n`);
  cpSync(
    join(packageDir, 'src/artifacts/brand-manifest-schema.d.ts'),
    join(outDir, 'brand-manifest.d.ts'),
  );
  const repoReadmePath = join(brandSource, 'README.md');
  const repoReadme = readFileSync(repoReadmePath, 'utf8');
  const regenerated = replaceManagedBlock(
    repoReadme,
    renderRepoIndexTable(brandManifest),
    'design-system-docs/README.md',
    '<!-- Generated from the brand manifest by build-artifacts.mjs. Do not edit by hand. -->',
  );
  if (regenerated !== repoReadme) {
    writeFileSync(repoReadmePath, regenerated);
  }

  /* 1. Brand skill — a subset of design-system-docs/, with its two
        repo-specific passages regenerated for a consumer audience. */
  const brandOut = join(skillsDir, SKILL_DIRS.brand);

  for (const entry of BRAND_SOURCES) {
    const from = join(brandSource, entry);
    statSync(from); // throws with the path if the source moved
    /* copyTree, not cpSync's `dereference`: that flag only governs the copy
       root, so the four stylesheet links survived it and the thirteen links
       inside `fonts/` were recreated as absolute links that `npm pack` then
       dropped (#77). copyTree materialises links at every depth. */
    copyTree(from, join(brandOut, entry));
  }

  /* The inventory the consumer reads is derived from the files that just landed
     in the tarball — every one of them, at full depth — plus the two documents
     written below. Comparing BRAND_SOURCES against a hand-kept list instead
     compared first path segments, so `ui_kits/_shared/` shipped undescribed
     under cover of the four `ui_kits/<kit>/` rows. transformBrandDocs throws on
     a file no row covers, and on a row no file backs. */
  const shipped = [...walk(brandOut), 'README.md', 'SKILL.md'];

  const { readme, skill } = transformBrandDocs({
    readme: readFileSync(join(brandSource, 'README.md'), 'utf8'),
    skill: readFileSync(join(brandSource, 'SKILL.md'), 'utf8'),
    referenceSkill: SKILL_DIRS.reference,
    shipped,
  });
  write(join(SKILL_DIRS.brand, 'README.md'), readme);
  write(join(SKILL_DIRS.brand, 'SKILL.md'), skill);

  /* 2. Component reference — generated from the published manifest by the same
        builder apps/docs serves /llms.txt from. Passing `versions` is what
        makes this output a snapshot rather than a live corpus; there is no
        prose to interleave here, so none is passed. */
  write(
    join(SKILL_DIRS.reference, 'llms.txt'),
    llmsIndex({ manifest, versions, alsoAvailable: SNAPSHOT_CONTENTS }),
  );
  write(
    join(SKILL_DIRS.reference, 'llms-full.txt'),
    llmsFull({
      manifest,
      contracts,
      tokens,
      versions,
      /* Only ships:true artifacts — this file travels in the tarball, and
         advertising repo-only material to a consumer is a broken pointer. */
      brand: {
        readme: regenerated,
        /* The pack this build packs, read from the source it copies into the brand
           skill above — deliberately not `resolveVoicePack`. This is the system's own
           tarball, and a `voice.json` sitting in whatever directory the build happened
           to run from must not decide what a consumer receives. */
        packId: JSON.parse(readFileSync(join(brandSource, 'miltinson.voice.json'), 'utf8')).id,
        note:
          'The full brand skill — tokens, assets, UI kits — ships alongside this one at ' +
          `.claude/skills/${SKILL_DIRS.brand}/.`,
        artifacts: brandManifest.artifacts.filter((artifact) => artifact.ships),
      },
    }),
  );
  write(
    join(SKILL_DIRS.reference, 'SKILL.md'),
    referenceSkillDoc({
      versions,
      componentCount: manifest.components.length,
      hookCount: manifest.hooks.length,
    }),
  );

  /* 3. The resync skill itself, so a repo that has the artifacts also has the
        instructions for refreshing them. */
  write(
    join(SKILL_DIRS.resync, 'SKILL.md'),
    readFileSync(join(packageDir, 'src/resync/SKILL.md'), 'utf8'),
  );

  /* 4. The stamp. `reactVersion` is what `ds-resync artifacts` compares against
        the consuming repo's install to decide whether to warn. */
  const files = walk(skillsDir).map((path) => {
    const staged = join(skillsDir, path);
    /* lstat, not stat: a symlink into the workspace resolves on the machine
       that built it, so `statSync` passes and `readFileSync` hashes the target
       happily — and then `npm pack` drops the entry because it points outside
       the package root. That is exactly how thirteen font assets shipped as
       manifest rows with no bytes behind them, through a green CI, and were
       only ever seen by consumers (#77). Everything in artifacts.json must be a
       regular file here or the tarball is a lie. */
    if (!lstatSync(staged).isFile()) {
      throw new Error(
        `dist/artifacts/skills/${path} is not a regular file. Every path in ` +
          'artifacts.json must be one: npm pack drops symlinks pointing outside ' +
          'the package root, so a link here ships as a missing file. See ' +
          'src/artifacts/copy-tree.mjs.',
      );
    }
    return { path, hash: sha256(readFileSync(staged)) };
  });

  writeFileSync(
    join(outDir, 'artifacts.json'),
    `${JSON.stringify(
      {
        $comment:
          'Generated by packages/ai-patterns/scripts/build-artifacts.mjs — do not edit by hand.',
        aiPatternsVersion: versions.aiPatterns,
        reactVersion: versions.react,
        tokensVersion: versions.tokens,
        targetRoot: '.claude/skills',
        files,
      },
      null,
      2,
    )}\n`,
  );

  process.stdout.write(
    `ai-patterns artifacts: ${files.length} files staged in dist/artifacts ` +
      `(react@${versions.react}, tokens@${versions.tokens})\n`,
  );
}

main();
