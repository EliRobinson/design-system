/* Stages design-system-docs/ into public/brand/ for the site's brand pages.
 *
 * The brand artifacts render as live <iframe>s of the real files — a
 * reproduction as React components would be a second copy that drifts — so
 * the files themselves have to be served, with their directory depth intact:
 * `../styles.css`, `_card.css`, and `../../colors_and_type.css` must all
 * still resolve exactly as written.
 *
 * Every copy materialises symlinks as real files. design-system-docs mirrors
 * packages/tokens by symlink (the root stylesheets and every file in fonts/),
 * and a link has nothing to point at once deployed. Directories go through
 * ai-patterns' copyTree, which explains why `cpSync` cannot do this.
 *
 * Two transforms, both forced by paths that escape the folder:
 * - `colors_and_type.css` is a symlink into packages/tokens — copied
 *   dereferenced, as build-artifacts.mjs already does for the tarball. Its own
 *   relative @imports are copied dereferenced beside it rather than flattened
 *   into it: they are siblings, they resolve from public/ exactly as written,
 *   and the staged preview should exercise the same @import chain a consumer's
 *   browser does. Flattening is for imports that point OUT of the folder.
 * - `styles.css` @imports the real component stylesheets from
 *   packages/react, which public/ cannot reach — it is flattened into one
 *   resolved sheet. Without this the component-dependent guideline cards
 *   (focus, spacing-in-use, type-mono) render unstyled.
 *
 * `preview/` (working material), `uploads/` (scratch), and
 * `_project-mirror/` (renders blank until ported — every entry loads a
 * _ds_bundle.js that was deliberately not copied) are not staged.
 */

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

/* Relative, not a package subpath: this is a build helper, not something
   @elirobinson/ai-patterns should publish. */
import { copyTree } from '../../../packages/ai-patterns/src/artifacts/copy-tree.mjs';

const appDir = process.cwd();
const source = join(appDir, '../../design-system-docs');
const out = join(appDir, 'public/brand');

const STAGED_DIRS = ['assets', 'guidelines', 'patterns', 'slides', 'ui_kits'];

/** `@import './x.css';` and `@import url('./x.css');` alike, target captured. */
const IMPORT_STATEMENT = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;/g;

/** Every symlink under `dir`. copyTree never writes one, so this only trips
    if a later edit copies with `cpSync` again, which keeps nested links. A
    staged link breaks the deploy: `vercel deploy --archive=tgz` rejects the
    whole upload with "is not a valid symlink". */
function symlinksUnder(dir) {
  return readdirSync(dir, { recursive: true })
    .map((name) => join(dir, name))
    .filter((path) => lstatSync(path).isSymbolicLink());
}

/** One stylesheet with every relative @import inlined; external @imports
    (Google Fonts) are hoisted to the top, where CSS requires them. */
function flattenCss(entryPath) {
  const externals = new Set();
  const seen = new Set();

  function inline(path) {
    const key = resolve(path);
    if (seen.has(key)) {
      return '';
    }
    seen.add(key);
    return readFileSync(key, 'utf8').replace(IMPORT_STATEMENT, (statement, target) => {
      if (/^https?:/.test(target)) {
        externals.add(statement);
        return '';
      }
      return inline(join(dirname(key), target));
    });
  }

  const body = inline(entryPath);
  return `${[...externals].join('\n')}\n${body}`;
}

/** Every file `entry` @imports, transitively, as a name relative to `source`.
    Anything but a sibling throws: staging flattens the tree into one directory,
    so a nested target would be copied to a path that does not exist and the
    failure would only show up as an unstyled iframe. */
function importedSiblings(entry) {
  const staged = new Set();
  const queue = [entry];

  while (queue.length > 0) {
    const css = readFileSync(join(source, queue.shift()), 'utf8');
    for (const [, target] of css.matchAll(IMPORT_STATEMENT)) {
      if (/^https?:/.test(target)) {
        continue; // hosted, not staged
      }
      const name = target.replace(/^\.\//, '');
      if (name.includes('/')) {
        throw new Error(`stage-brand: ${entry} @imports ${target}; only siblings can be staged.`);
      }
      /* design-system-docs mirrors the token package by symlink, one file at a
         time, so a layer added there arrives here as a missing sibling. Say
         which link to make — the alternative is a brand preview that renders
         without the layer and says nothing. */
      if (!existsSync(join(source, name))) {
        throw new Error(
          `stage-brand: ${entry} @imports ./${name}, which design-system-docs does not have. ` +
            `Add the symlink: ln -s ../packages/tokens/src/${name} design-system-docs/${name}`,
        );
      }
      if (!staged.has(name)) {
        staged.add(name);
        queue.push(name);
      }
    }
  }
  return staged;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const dir of STAGED_DIRS) {
  copyTree(join(source, dir), join(out, dir));
}
/* copyFileSync follows the symlink, so the copy is the dereferenced file. */
copyFileSync(join(source, 'colors_and_type.css'), join(out, 'colors_and_type.css'));
/* And everything it @imports, transitively. This is derived from the file
   rather than listed here because the list is not ours: colors_and_type.css is
   tokens.css, which now pulls in a palette layer and a platform layer, and a
   staged copy missing those parses, applies, and renders the whole brand
   preview greyscale without one error in the console. A fourth layer stages
   itself.

   Each target resolves from public/brand exactly as it did from
   design-system-docs, because they all land beside each other — which is also
   how fonts.css finds `./fonts/`. */
for (const sibling of importedSiblings('colors_and_type.css')) {
  copyFileSync(join(source, sibling), join(out, sibling));
}
copyTree(join(source, 'fonts'), join(out, 'fonts'));
writeFileSync(join(out, 'styles.css'), flattenCss(join(source, 'styles.css')));

const links = symlinksUnder(out);
if (links.length > 0) {
  throw new Error(`stage-brand: staged symlinks instead of files: ${links.join(', ')}`);
}

process.stdout.write(`Brand artifacts staged in public/brand from ${source}\n`);
