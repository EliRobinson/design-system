/* components/bundle.css for the Claude "Design System" artifact.
 *
 * The artifact loads it after its compiled tokens.css. In order:
 *
 *   a. the token values tokens.json cannot hold, and mobile.css
 *   b. the element rules in tokens.css (its custom-property blocks and
 *      @imports removed: the artifact's tokens.css holds those values)
 *   c. @elirobinson/react's styles.css, its imports inlined in order
 *   d. the Miltinson × AI Elements class layers from apps/docs and the docs
 *      app's ai-theme-*.css fixups, in its import order, then the
 *      stylesheets of the artifact-only components (artifact-only.mjs), read
 *      back from the previous bundle.css
 *   e. the scoped [data-palette] blocks from palettes.css
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { tokenBlocks } from '@elirobinson/tokens/contrast';
import {
  readPlatformStylesheets,
  readTokenStylesheets,
} from '@elirobinson/tokens/token-stylesheets';
import postcss from 'postcss';

import { ARTIFACT_ONLY } from './artifact-only.mjs';

export const AI_THEME_ENTRY = 'apps/docs/src/app/elements.css';
export const AI_THEME_ENTRY_DIR = dirname(AI_THEME_ENTRY);
export const AI_THEME_DIR = `${AI_THEME_ENTRY_DIR}/ai-theme`;
/* Section e's title. A carried section ends where it starts. */
const SCOPED_PALETTES = 'Scoped palettes';
/* The token bridge is not a class layer: the artifact carries it as its own file. */
const AI_THEME_NOT_LAYERS = ['ai-bridge'];
const CARRIED = '(previous artifact bundle)';

const marker = (label) => `/* ── ${label} ── */`;
/* A whole marker line. A comment inside a carried stylesheet does not end its section. */
const MARKER_LINE = /^\/\* ── .+ ── \*\/$/;

/**
 * Every AI theme stylesheet the docs app imports, in its import order: the class layers in
 * `ai-theme/` (the token bridge left out) and the docs app's `ai-theme-*.css` fixups next to
 * the entry. The fixups correct the layers, which read tokens no one declares without them
 * (#352, #250), so the artifact keeps the docs app's order exactly. An `./ai-theme…` import
 * that is neither throws, so no sheet is dropped without a sound.
 */
export function aiThemeImports(entryCss) {
  const sheets = [...entryCss.matchAll(/@import '\.\/(ai-theme[^']*)\.css';/g)]
    .map(([, path]) => {
      const layer = path.match(/^ai-theme\/(ai-[\w-]+)$/);
      if (layer) return { name: layer[1], dir: AI_THEME_DIR, layer: true };
      const fixup = path.match(/^(ai-theme-[\w-]+)$/);
      if (fixup) return { name: fixup[1], dir: AI_THEME_ENTRY_DIR, layer: false };
      throw new Error(
        `${AI_THEME_ENTRY} imports ./${path}.css, which is neither an ai-theme/ layer nor an ai-theme-*.css fixup`,
      );
    })
    .filter((sheet) => !AI_THEME_NOT_LAYERS.includes(sheet.name));
  if (!sheets.some((sheet) => sheet.layer)) {
    throw new Error(`${AI_THEME_ENTRY} imports no ai-theme layer`);
  }
  return sheets;
}

/** The AI Elements class layers, in the order the docs app imports them. */
export const aiLayers = (entryCss) =>
  aiThemeImports(entryCss)
    .filter((sheet) => sheet.layer)
    .map((sheet) => sheet.name);

/** One section of a previous bundle.css, by its marker line. */
export function previousSection(bundleCss, path) {
  const lines = bundleCss.split('\n');
  const start = lines.indexOf(marker(`${path} ${CARRIED}`));
  if (start < 0) throw new Error(`previous bundle.css has no section for ${path}`);
  let end = start + 1;
  while (
    end < lines.length &&
    !MARKER_LINE.test(lines[end]) &&
    !lines[end].startsWith(`/* ${SCOPED_PALETTES}`)
  )
    end++;
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
}

function tokenNames(tokensSrc) {
  const sources = [...readTokenStylesheets(tokensSrc), ...readPlatformStylesheets(tokensSrc)];
  return new Set(tokenBlocks(sources).flatMap((block) => block.declarations.map(([name]) => name)));
}

function tokensElementRules(tokensCss) {
  const root = postcss.parse(tokensCss);
  const drop = [];
  root.each((node) => {
    const selector = node.type === 'rule' ? node.selector.replace(/\s+/g, ' ').trim() : '';
    const isVarsBlock = selector === ':root' || selector === "[data-theme='dark'], .dark";
    if (!(node.type === 'atrule' && node.name === 'import') && !isVarsBlock) return;
    if (
      isVarsBlock &&
      node.nodes.some((decl) => decl.type === 'decl' && !decl.prop.startsWith('--'))
    ) {
      throw new Error(`tokens.css ${selector} carries a non-custom declaration; it would be lost`);
    }
    drop.push(node);
    for (let prev = node.prev(); prev?.type === 'comment'; prev = prev.prev()) drop.push(prev);
  });
  if (root.first?.type === 'comment') drop.push(root.first);
  for (const node of drop) node.remove();
  return root
    .toString()
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function scopedPalettes(palettesCss) {
  const root = postcss.parse(palettesCss);
  const first = root.nodes.findIndex(
    (node) => node.type === 'rule' && node.selector.trim().startsWith('[data-palette='),
  );
  if (first < 0) throw new Error('palettes.css has no [data-palette] block');
  let start = first;
  while (root.nodes[start - 1]?.type === 'comment') start--;
  for (const node of root.nodes.slice(start)) {
    if (node.type === 'rule' && !node.selector.trim().startsWith('[data-palette=')) {
      throw new Error(`palettes.css: unscoped rule after the palette blocks: ${node.selector}`);
    }
  }
  return palettesCss.slice(root.nodes[start].source.start.offset).trim();
}

/**
 * @elirobinson/react's src/styles.css with its imports inlined in order, each
 * under its own marker. The tokens.css import is left out: whoever loads this
 * loads the tokens first. The UI kits' stylesheet is this and nothing else.
 */
export function reactComponentCss(repoRoot) {
  const read = (path) => readFileSync(join(repoRoot, path), 'utf8');
  const imports = [...read('packages/react/src/styles.css').matchAll(/@import '([^']+)';/g)]
    .map((match) => match[1])
    .filter((path) => path !== '@elirobinson/tokens/tokens.css');
  if (!imports.length) throw new Error('packages/react/src/styles.css imports nothing');
  return imports
    .map((path) => {
      const relative = path.replace(/^\.\//, '');
      return `${marker(relative)}\n${read(`packages/react/src/${relative}`).trim()}`;
    })
    .join('\n\n');
}

/**
 * @param {object} options
 * @param {string} options.repoRoot
 * @param {string} options.tokensSrc   packages/tokens/src
 * @param {string} options.extrasCss   from buildTokens
 * @param {string} options.previousBundleCss  the live artifact's components/bundle.css
 * @param {string} options.reactVersion
 * @param {string} options.ref         short sha
 */
export function buildBundleCss({
  repoRoot,
  tokensSrc,
  extrasCss,
  previousBundleCss,
  reactVersion,
  ref,
}) {
  const read = (path) => readFileSync(join(repoRoot, path), 'utf8');
  const readTokens = (file) => readFileSync(join(tokensSrc, file), 'utf8');
  const tokens = tokenNames(tokensSrc);
  const parts = [];

  parts.push(
    `${marker('a. extras/tokens-not-in-json.css: values tokens.json cannot hold, plus the mobile platform layer')}\n` +
      `/* Token values tokens.json cannot hold, with their exact repo values (packages/tokens/src @ ${ref}).\n` +
      '   For the bundle stylesheet, which loads after tokens.css. Not published as its own file. */\n\n' +
      extrasCss.trim(),
  );

  parts.push(
    `${marker('b. @elirobinson/tokens src/tokens.css: the global element rules (custom-property blocks and @imports removed; the values come from tokens.css)')}\n` +
      tokensElementRules(readTokens('tokens.css')),
  );

  parts.push(
    `${marker(`c. @elirobinson/react ${reactVersion} src/styles.css, imports inlined in order (tokens.css import left out)`)}\n\n` +
      reactComponentCss(repoRoot),
  );

  const noTokenDeclarations = (css, label) =>
    postcss.parse(css).walkDecls((decl) => {
      if (tokens.has(decl.prop)) throw new Error(`${label} declares the token ${decl.prop}`);
    });
  const sheets = aiThemeImports(read(AI_THEME_ENTRY));
  let ai =
    `/* The Miltinson × AI Elements stylesheets (${sheets.map((sheet) => sheet.name).join(', ')}),\n` +
    `   in the order ${AI_THEME_ENTRY} imports them: the class layers from ${AI_THEME_DIR}/ and\n` +
    `   the docs app's ai-theme-*.css fixups. Then the stylesheets of the artifact-only components,\n` +
    `   ${ARTIFACT_ONLY.names.join(' and ')}, carried from the previous artifact bundle. No token declarations. */`;
  for (const { name, dir } of sheets) {
    const css = read(`${dir}/${name}.css`).trim();
    noTokenDeclarations(css, `${name}.css`);
    ai += `\n\n${marker(`components/ai/${name}.css (${dir})`)}\n${css}`;
  }
  for (const path of ARTIFACT_ONLY.names.map(ARTIFACT_ONLY.stylesheet)) {
    const css = previousSection(previousBundleCss, path);
    noTokenDeclarations(css, path);
    ai += `\n\n${marker(`${path} ${CARRIED}`)}\n${css}`;
  }
  parts.push(ai);

  parts.push(
    `/* ${SCOPED_PALETTES}, verbatim from packages/tokens/src/palettes.css.\n` +
      '   The theme switch sets palettes on <html> through tokens.css. These blocks let a card show\n' +
      '   several palettes side by side with data-palette on an element. No :root rules here. */\n' +
      scopedPalettes(readTokens('palettes.css')),
  );

  const out =
    `/* Miltinson Design System — component stylesheet. Loaded after tokens.css. Built from @elirobinson/react ${reactVersion} and @elirobinson/tokens at ${ref}. */\n\n` +
    `${parts.join('\n\n')}\n`;
  /* Consumers inline this file in a <style> element. */
  if (/<\/style/i.test(out)) throw new Error('bundle.css contains </style');
  postcss.parse(out);
  return out;
}
