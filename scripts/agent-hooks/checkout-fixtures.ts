import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Checkouts = {
  /** The real path of the temp folder that holds the rest. */
  root: string;
  /** `root/main`: a main checkout (`.git` is a directory). */
  main: string;
  /** `main/.claude/worktrees/wt`: a linked worktree (`.git` is a file). */
  wt: string;
  /** `root/other`: another project's main checkout. */
  other: string;
};

/**
 * Lays out checkouts on disk the way git does, in a new temp folder named
 * from `prefix`. `main/packages/react` is a subfolder, and `wt/shared` is a
 * symlink to `main/packages`. Remove it with {@link removeCheckouts}.
 */
export function makeCheckouts(prefix: string): Checkouts {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  const main = join(root, 'main');
  const wt = join(main, '.claude/worktrees/wt');
  const other = join(root, 'other');
  mkdirSync(join(main, '.git/worktrees/wt'), { recursive: true });
  mkdirSync(join(main, 'packages/react'), { recursive: true });
  mkdirSync(wt, { recursive: true });
  writeFileSync(join(wt, '.git'), `gitdir: ${join(main, '.git/worktrees/wt')}\n`);
  mkdirSync(join(other, '.git'), { recursive: true });
  symlinkSync(join(main, 'packages'), join(wt, 'shared'));
  return { root, main, wt, other };
}

export function removeCheckouts({ root }: Checkouts) {
  rmSync(root, { recursive: true, force: true });
}
