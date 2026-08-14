/* Stages design-system-docs/ into public/brand/ for the site's brand pages.
 *
 * The brand artifacts render as live <iframe>s of the real files — a
 * reproduction as React components would be a second copy that drifts — so
 * the files themselves have to be served, with their directory depth intact:
 * `../styles.css`, `_card.css`, and `../../colors_and_type.css` must all
 * still resolve exactly as written.
 *
 * Two transforms, both forced by paths that escape the folder:
 * - `colors_and_type.css` is a symlink into packages/tokens — copied
 *   dereferenced, as build-artifacts.mjs already does for the tarball.
 * - `styles.css` @imports the real component stylesheets from
 *   packages/react, which public/ cannot reach — it is flattened into one
 *   resolved sheet. Without this the component-dependent guideline cards
 *   (focus, spacing-in-use, type-mono) render unstyled.
 *
 * `preview/` (working material), `uploads/` (scratch), and
 * `_project-mirror/` (renders blank until ported — every entry loads a
 * _ds_bundle.js that was deliberately not copied) are not staged.
 */

import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const appDir = process.cwd();
const source = join(appDir, '../../design-system-docs');
const out = join(appDir, 'public/brand');

const STAGED_DIRS = ['assets', 'guidelines', 'patterns', 'slides', 'ui_kits'];

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
    return readFileSync(key, 'utf8').replace(
      /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;/g,
      (statement, target) => {
        if (/^https?:/.test(target)) {
          externals.add(statement);
          return '';
        }
        return inline(join(dirname(key), target));
      },
    );
  }

  const body = inline(entryPath);
  return `${[...externals].join('\n')}\n${body}`;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const dir of STAGED_DIRS) {
  cpSync(join(source, dir), join(out, dir), { recursive: true, dereference: true });
}
/* copyFileSync follows the symlink, so the copy is the dereferenced file. */
copyFileSync(join(source, 'colors_and_type.css'), join(out, 'colors_and_type.css'));
/* The self-hosted faces colors_and_type.css @imports — fonts.css resolves
   `./fonts/` against its own URL, so both stage at the top level beside it. */
copyFileSync(join(source, 'fonts.css'), join(out, 'fonts.css'));
cpSync(join(source, 'fonts'), join(out, 'fonts'), { recursive: true, dereference: true });
writeFileSync(join(out, 'styles.css'), flattenCss(join(source, 'styles.css')));

process.stdout.write(`Brand artifacts staged in public/brand from ${source}\n`);
