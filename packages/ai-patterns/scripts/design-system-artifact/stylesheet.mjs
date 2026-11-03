/* components/bundle.css for the Claude "Design System" artifact.
 *
 * The artifact loads it after its compiled tokens.css. In order:
 *
 *   a. the token values tokens.json cannot hold, and mobile.css
 *   b. the element rules in tokens.css (its custom-property blocks and
 *      @imports removed: the artifact's tokens.css holds those values)
 *   c. @elirobinson/react's styles.css, its imports inlined in order
 *   d. the Miltinson × AI Elements class layers from apps/docs, then the
 *      stylesheets of ChatComposer and PromptSuggestions, which exist only in
 *      the artifact and are read back from its previous bundle.css
 *   e. the scoped [data-palette] blocks from palettes.css (blocks 3-10)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postcss from 'postcss';

export const AI_LAYERS = ['ai-core', 'ai-agent', 'ai-media', 'ai-canvas', 'ai-shell'];
export const ARTIFACT_ONLY_STYLESHEETS = [
  'components/ai/ChatComposer.css',
  'components/ai/PromptSuggestions.css',
];
const CARRIED = '(previous artifact bundle)';

const marker = (label) => `/* ── ${label} ── */`;

/** One section of a previous bundle.css, by its marker line. */
export function previousSection(bundleCss, path) {
  const lines = bundleCss.split('\n');
  const start = lines.indexOf(marker(`${path} ${CARRIED}`));
  if (start < 0) throw new Error(`previous bundle.css has no section for ${path}`);
  let end = start + 1;
  while (end < lines.length && !/^\/\* (── |Scoped palettes)/.test(lines[end])) end++;
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
}

function tokenNames(tokensSrc) {
  const names = new Set();
  for (const file of ['tokens.css', 'palettes.css', 'mobile.css']) {
    postcss.parse(readFileSync(join(tokensSrc, file), 'utf8')).walkDecls((decl) => {
      if (decl.prop.startsWith('--')) names.add(decl.prop);
    });
  }
  return names;
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
 * @param {object} options
 * @param {string} options.repoRoot
 * @param {string} options.extrasCss   from buildTokens
 * @param {string} options.previousBundleCss  the live artifact's components/bundle.css
 * @param {string} options.reactVersion
 * @param {string} options.ref         short sha
 */
export function buildBundleCss({ repoRoot, extrasCss, previousBundleCss, reactVersion, ref }) {
  const read = (path) => readFileSync(join(repoRoot, path), 'utf8');
  const tokensSrc = join(repoRoot, 'packages/tokens/src');
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
      tokensElementRules(read('packages/tokens/src/tokens.css')),
  );

  const styles = read('packages/react/src/styles.css');
  const imports = [...styles.matchAll(/@import '([^']+)';/g)]
    .map((match) => match[1])
    .filter((path) => path !== '@elirobinson/tokens/tokens.css');
  if (!imports.length) throw new Error('packages/react/src/styles.css imports nothing');
  let components = marker(
    `c. @elirobinson/react ${reactVersion} src/styles.css, imports inlined in order (tokens.css import left out)`,
  );
  for (const path of imports) {
    const relative = path.replace(/^\.\//, '');
    components += `\n\n${marker(relative)}\n${read(`packages/react/src/${relative}`).trim()}`;
  }
  parts.push(components);

  const noTokenDeclarations = (css, label) =>
    postcss.parse(css).walkDecls((decl) => {
      if (tokens.has(decl.prop)) throw new Error(`${label} declares the token ${decl.prop}`);
    });
  let ai =
    '/* The Miltinson × AI Elements class layers (ai-core, ai-agent, ai-media, ai-canvas, ai-shell) from\n' +
    '   apps/docs/src/app/ai-theme/, then the stylesheets of the two artifact-only components, ChatComposer\n' +
    '   and PromptSuggestions, carried from the previous artifact bundle. No token declarations. */';
  for (const layer of AI_LAYERS) {
    const css = read(`apps/docs/src/app/ai-theme/${layer}.css`).trim();
    noTokenDeclarations(css, `${layer}.css`);
    ai += `\n\n${marker(`components/ai/${layer}.css (apps/docs/src/app/ai-theme)`)}\n${css}`;
  }
  for (const path of ARTIFACT_ONLY_STYLESHEETS) {
    const css = previousSection(previousBundleCss, path);
    noTokenDeclarations(css, path);
    ai += `\n\n${marker(`${path} ${CARRIED}`)}\n${css}`;
  }
  parts.push(ai);

  parts.push(
    '/* Scoped palettes, verbatim from packages/tokens/src/palettes.css (blocks 3-10).\n' +
      '   The theme switch sets palettes on <html> through tokens.css. These blocks let a card show\n' +
      '   several palettes side by side with data-palette on an element. No :root rules here. */\n' +
      scopedPalettes(read('packages/tokens/src/palettes.css')),
  );

  const out =
    `/* Miltinson Design System — component stylesheet. Loaded after tokens.css. Built from @elirobinson/react ${reactVersion} and @elirobinson/tokens at ${ref}. */\n\n` +
    `${parts.join('\n\n')}\n`;
  /* Consumers inline this file in a <style> element. */
  if (/<\/style/i.test(out)) throw new Error('bundle.css contains </style');
  postcss.parse(out);
  return out;
}
