/* The UI kits, as the Design System artifact serves them.
 *
 * The kits in design-system-docs/ui_kits/ load the tokens from
 * `../../colors_and_type.css` and the components from `../_shared/ds-bundle.*`.
 * The artifact already has all three: its compiled tokens.css, and
 * components/bundle.css and components/bundle.js, which hold the same component
 * styles and builds plus every scoped palette. So each page's links are pointed
 * there, and the script tag also names the artifact's global window.DesignSystem,
 * the name the kits read. No second bundle is built.
 *
 * Every other file is copied as it is.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { listFiles } from '../../src/artifacts/list-files.mjs';
import { KIT_BUNDLE_FILES, KIT_GLOBAL } from '../kit-bundle.mjs';
import { NAMESPACE } from './bundle.mjs';

const REWRITES = [
  [
    '<link rel="stylesheet" href="../../colors_and_type.css">',
    '<link rel="stylesheet" href="../../tokens.css">',
  ],
  [
    `<link rel="stylesheet" href="../_shared/${KIT_BUNDLE_FILES.css}">`,
    '<link rel="stylesheet" href="../../components/bundle.css">',
  ],
  [
    `<script src="../_shared/${KIT_BUNDLE_FILES.js}"></script>`,
    '<script src="../../components/bundle.js"></script>\n' +
      `<script>window.${KIT_GLOBAL} = window.${NAMESPACE};</script>`,
  ],
];

/** One kit page pointed at the artifact's own files. Throws if a tag to rewrite is missing. */
export function artifactKitPage(html, label = 'kit page') {
  let out = html;
  for (const [from, to] of REWRITES) {
    if (!out.includes(from)) throw new Error(`ui_kits: ${label} has no ${from}`);
    out = out.replace(from, to);
  }
  return out;
}

/** Map of artifact path (`ui_kits/...`) to text. */
export function artifactKitFiles(repoRoot) {
  const kitsDir = join(repoRoot, 'design-system-docs/ui_kits');
  const files = new Map();
  for (const name of listFiles(kitsDir)) {
    const text = readFileSync(join(kitsDir, name), 'utf8');
    files.set(`ui_kits/${name}`, name.endsWith('.html') ? artifactKitPage(text, name) : text);
  }
  return files;
}
