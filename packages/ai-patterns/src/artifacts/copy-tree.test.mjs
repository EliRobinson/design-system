/* The unit half of the #77 guard. The integration half is pack-integrity.test.mjs,
   which checks the real tarball; this one pins the behaviour that made the bug
   possible: a link left as a link anywhere in the copy. */
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { copyTree } from './copy-tree.mjs';

let root;
let source;
let target;

/* Mirrors design-system-docs/: real files off to one side, and a directory
   whose entries are all relative symlinks pointing out of the copy root. */
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'copy-tree-'));
  target = join(root, 'real');
  source = join(root, 'docs');

  mkdirSync(join(target, 'fonts'), { recursive: true });
  writeFileSync(join(target, 'tokens.css'), ':root { --x: 1px; }\n');
  writeFileSync(join(target, 'fonts', 'a.woff2'), 'font-a');
  writeFileSync(join(target, 'fonts', 'LICENSE.txt'), 'license');

  mkdirSync(join(source, 'fonts'), { recursive: true });
  symlinkSync('../real/tokens.css', join(source, 'colors_and_type.css'));
  symlinkSync('../../real/fonts/a.woff2', join(source, 'fonts', 'a.woff2'));
  symlinkSync('../../real/fonts/LICENSE.txt', join(source, 'fonts', 'LICENSE.txt'));
  symlinkSync('../real/fonts', join(source, 'fonts-link'));
  writeFileSync(join(source, 'fonts.css'), '@font-face {}\n');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('copyTree', () => {
  it('materialises a symlink passed as the copy root', () => {
    const out = join(root, 'out.css');
    copyTree(join(source, 'colors_and_type.css'), out);

    expect(lstatSync(out).isFile()).toBe(true);
    expect(readFileSync(out, 'utf8')).toBe(':root { --x: 1px; }\n');
  });

  it('materialises symlinks met inside a copied directory', () => {
    const out = join(root, 'out-fonts');
    copyTree(join(source, 'fonts'), out);

    expect(lstatSync(join(out, 'a.woff2')).isFile()).toBe(true);
    expect(lstatSync(join(out, 'LICENSE.txt')).isFile()).toBe(true);
    expect(readFileSync(join(out, 'a.woff2'), 'utf8')).toBe('font-a');
  });

  /* The bug itself (#77): a link recreated as a link in the copy was dropped by
     `npm pack`. Walk the whole output and fail on any link at any depth. This
     does not lean on what `cpSync` does with nested links, which differs by
     Node version (Node 24 keeps them, Node 26 follows them). */
  it('leaves no symlink anywhere in the copied tree', () => {
    const out = join(root, 'out-walk');
    copyTree(source, out);

    const links = [];
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        const stat = lstatSync(path);
        if (stat.isSymbolicLink()) links.push(path);
        else if (stat.isDirectory()) walk(path);
        else files.push(relative(out, path));
      }
    };
    walk(out);

    expect(links).toEqual([]);
    expect(files.sort()).toEqual([
      'colors_and_type.css',
      'fonts-link/LICENSE.txt',
      'fonts-link/a.woff2',
      'fonts.css',
      'fonts/LICENSE.txt',
      'fonts/a.woff2',
    ]);
  });

  it('copies plain files and nested directories unchanged', () => {
    const out = join(root, 'out-all');
    copyTree(source, out);

    expect(readFileSync(join(out, 'fonts.css'), 'utf8')).toBe('@font-face {}\n');
    expect(lstatSync(join(out, 'fonts', 'LICENSE.txt')).isFile()).toBe(true);
  });

  it('throws, naming the path, on a link with no target', () => {
    symlinkSync('../real/gone.css', join(source, 'gone.css'));

    expect(() => copyTree(source, join(root, 'out-broken'))).toThrow(/gone\.css/);
  });
});
