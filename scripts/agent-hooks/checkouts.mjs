// @ts-check
// Which checkout a folder is in: a main checkout or a linked worktree. Read
// from disk only, with no shell parser, so the guard's crash path can use it
// when the parser fails to load (#479). See guard-main-checkout-policy.mjs.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * The real path of `p`, or `p` when it does not exist.
 * @param {string} p
 */
export function truePath(p) {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
}

/**
 * The nearest folder at or above `dir` that holds a `.git`, with what kind
 * it is: a main checkout (`.git` is a folder) or a linked worktree (a file).
 * @param {string} dir
 * @returns {{ root: string, kind: 'main' | 'linked' } | null}
 */
export function checkoutOf(dir) {
  // Git works from the real path, so a symlink into another checkout counts
  // as that checkout. Resolve the nearest folder that exists.
  let start = resolve(dir);
  while (!existsSync(start) && dirname(start) !== start) start = dirname(start);
  for (let current = truePath(start); ; current = dirname(current)) {
    const dotGit = join(current, '.git');
    if (existsSync(dotGit)) {
      const kind = statSync(dotGit).isDirectory() ? 'main' : 'linked';
      return { root: truePath(current), kind };
    }
    if (dirname(current) === current) return null;
  }
}

/**
 * The real path of the main checkout that `dir` is in, or is a linked
 * worktree of. Null when that cannot be read from disk.
 * @param {string} dir
 * @returns {string | null}
 */
export function mainCheckoutOf(dir) {
  const checkout = checkoutOf(dir);
  if (checkout === null) return null;
  if (checkout.kind === 'main') return checkout.root;
  let gitdir;
  try {
    gitdir = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(join(checkout.root, '.git'), 'utf8'))?.[1];
  } catch {
    return null;
  }
  if (gitdir === undefined) return null;
  const full = resolve(checkout.root, gitdir);
  const at = full.lastIndexOf(`${sep}.git${sep}worktrees${sep}`);
  return at === -1 ? null : truePath(full.slice(0, at));
}

/**
 * Whether `dir` is in the main checkout `mainRoot`. A null `dir` is a folder
 * this file could not work out, and counts as the main checkout. A null
 * `mainRoot` means the hook could not find its own repo, and then every main
 * checkout counts, so the guard keeps guarding. `added` holds the worktrees
 * that a `git worktree add` earlier on the line makes: they do not exist
 * yet, so the disk cannot say what they are.
 * @param {string | null} dir
 * @param {string | null} mainRoot
 * @param {string[]} added
 */
export function inMainCheckout(dir, mainRoot, added) {
  if (dir === null) return true;
  if (added.some((path) => dir === path || dir.startsWith(`${path}${sep}`))) return false;
  const checkout = checkoutOf(dir);
  return (
    checkout !== null &&
    checkout.kind === 'main' &&
    (mainRoot === null || checkout.root === mainRoot)
  );
}
