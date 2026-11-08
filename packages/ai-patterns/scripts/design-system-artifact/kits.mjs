/* The UI kits, as the Design System artifact serves them.
 *
 * The kits in design-system-docs/ui_kits/ load the tokens from
 * `../../colors_and_type.css` and the components from `../_shared/ds-bundle.*`.
 * The artifact has neither stylesheet: it has its own compiled tokens.css and
 * components/bundle.css, which hold the same values, the element rules and every
 * scoped palette. So the two stylesheet links are pointed there, and only
 * ds-bundle.js is added, because it is what puts the components on
 * window.DesignSystem, the name the kits read.
 *
 * Every other file is copied as it is.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { KIT_BUNDLE_FILES, buildKitBundle } from '../kit-bundle.mjs';

const STYLESHEETS = [
  ['../../colors_and_type.css', '../../tokens.css'],
  [`../_shared/${KIT_BUNDLE_FILES.css}`, '../../components/bundle.css'],
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** One kit page with its stylesheet links pointed at the artifact's. Throws if a link is missing. */
export function artifactKitPage(html, label = 'kit page') {
  let out = html;
  for (const [from, to] of STYLESHEETS) {
    const link = `<link rel="stylesheet" href="${from}">`;
    if (!out.includes(link)) throw new Error(`ui_kits: ${label} has no ${link}`);
    out = out.replace(link, `<link rel="stylesheet" href="${to}">`);
  }
  return out;
}

/** Map of artifact path (`ui_kits/...`) to text. */
export async function artifactKitFiles(repoRoot) {
  const kitsDir = join(repoRoot, 'design-system-docs/ui_kits');
  const files = new Map();
  for (const path of walk(kitsDir).sort()) {
    const name = relative(kitsDir, path).split('\\').join('/');
    const text = readFileSync(path, 'utf8');
    files.set(`ui_kits/${name}`, name.endsWith('.html') ? artifactKitPage(text, name) : text);
  }
  const { js } = await buildKitBundle();
  files.set(`ui_kits/_shared/${KIT_BUNDLE_FILES.js}`, js);
  return files;
}
