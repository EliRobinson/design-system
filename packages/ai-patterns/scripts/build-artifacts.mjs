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
 * - The llms snapshot derives from the *committed* component manifest, not from
 *   a fresh `apps/docs` build. `.github/workflows/quality.yml` fails the build
 *   if that committed file is stale, which is what makes reading it safe.
 * - `preview/` and `uploads/` are working material for this repo and never
 *   ship; `slides/` and `templates/` produce Miltinson marketing collateral,
 *   which a consuming product repo has no use for. See BRAND_SOURCES.
 */

import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';

import { BRAND_INDEX, transformBrandDocs } from '../src/artifacts/brand.mjs';
import { llmsFull, llmsIndex } from '../src/artifacts/llms.mjs';
import { referenceSkillDoc, SKILL_DIRS } from '../src/artifacts/skills.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(packageDir, '..', '..');
const outDir = join(packageDir, 'dist', 'artifacts');
const skillsDir = join(outDir, 'skills');

/* Copied verbatim out of design-system-docs/. Anything not listed is
   repo-internal. Keep in step with BRAND_INDEX — the check below enforces it. */
const BRAND_SOURCES = ['colors_and_type.css', 'assets', 'ui_kits'];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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

  const manifest = readJson(join(repoRoot, 'apps/docs/src/generated/component-manifest.json'));
  const contracts = readJson(join(packageDir, 'src/contracts.json'));
  const tokens = parseTokensCss(
    readFileSync(join(repoRoot, 'packages/tokens/src/tokens.css'), 'utf8'),
  );

  if (!manifest.components?.length) {
    throw new Error('component-manifest.json has no components — run `pnpm nx run docs:build`.');
  }
  if (tokens.length === 0) {
    throw new Error('No tokens parsed from packages/tokens/src/tokens.css.');
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(skillsDir, { recursive: true });

  /* 1. Brand skill — a subset of design-system-docs/, with its two
        repo-specific passages regenerated for a consumer audience. */
  const brandSource = join(repoRoot, 'design-system-docs');
  const brandOut = join(skillsDir, SKILL_DIRS.brand);

  for (const entry of BRAND_SOURCES) {
    const from = join(brandSource, entry);
    statSync(from); // throws with the path if the source moved
    // dereference: colors_and_type.css is a symlink to packages/tokens/src/tokens.css.
    cpSync(from, join(brandOut, entry), { recursive: true, dereference: true });
  }

  const { readme, skill } = transformBrandDocs({
    readme: readFileSync(join(brandSource, 'README.md'), 'utf8'),
    skill: readFileSync(join(brandSource, 'SKILL.md'), 'utf8'),
    referenceSkill: SKILL_DIRS.reference,
  });
  write(join(SKILL_DIRS.brand, 'README.md'), readme);
  write(join(SKILL_DIRS.brand, 'SKILL.md'), skill);

  const documented = new Set(
    BRAND_INDEX.map((entry) => entry.path.replace(/\/$/, '').split('/')[0]),
  );
  for (const entry of [...BRAND_SOURCES, 'README.md', 'SKILL.md']) {
    if (!documented.has(entry)) {
      throw new Error(
        `BRAND_SOURCES ships "${entry}" but BRAND_INDEX in src/artifacts/brand.mjs does not ` +
          'describe it, so the generated inventory would omit it.',
      );
    }
  }

  /* 2. Component reference — generated from the committed manifest. */
  write(join(SKILL_DIRS.reference, 'llms.txt'), llmsIndex({ manifest, versions }));
  write(
    join(SKILL_DIRS.reference, 'llms-full.txt'),
    llmsFull({ manifest, contracts, tokens, versions }),
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
  const files = walk(skillsDir).map((path) => ({
    path,
    hash: sha256(readFileSync(join(skillsDir, path))),
  }));

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
