/* Copying a source tree into the tarball with every symlink turned into a real
 * file — at any depth, not just at the copy root.
 *
 * `design-system-docs/` mirrors the tokens package by symlink: four stylesheets
 * at its root and all thirteen files under `fonts/` point into
 * `packages/tokens/src/`. `cpSync(from, to, { recursive: true, dereference:
 * true })` handles the first group and not the second — `dereference` decides
 * how the *copy root* is treated, and links met during the recursive walk are
 * recreated as links, rewritten to absolute, machine-specific targets.
 *
 * That is invisible on the build machine (the targets exist, so reading and
 * hashing them both succeed) and fatal in the tarball: `npm pack` drops a
 * symlink whose target is outside the package root, so all thirteen font assets
 * were listed in the manifest and absent from the published package, and
 * `ds-resync artifacts --write` died with ENOENT on the first one (#77).
 *
 * The fix is deliberately general rather than a special case for `fonts`: any
 * directory mirrored into design-system-docs later is the same trap, and a
 * copier that materialises links everywhere has no such edge to remember.
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Copy `from` to `to`, materialising symlinks — at the root and at every depth
 * below it — as regular files holding their target's bytes.
 *
 * `statSync` follows links, so a link to a directory is walked as a directory,
 * and `copyFileSync` reads through a link and writes a plain file. A broken
 * link throws, naming the path, rather than being copied as a dangling entry.
 *
 * @param {string} from Source file or directory. May itself be a symlink.
 * @param {string} to Destination path. Parent directories are created.
 */
export function copyTree(from, to) {
  if (!statSync(from).isDirectory()) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    return;
  }

  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    copyTree(join(from, entry), join(to, entry));
  }
}
