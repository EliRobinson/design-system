// README.md "Packages" is the one list of the packages under packages/*. AGENTS.md points
// to it instead of repeating names, so a new package needs one edit, not two.
// Private packages (the starter) are listed too, and marked as private.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const packages = readdirSync(join(root, 'packages'))
  .filter((dir) => existsSync(join(root, 'packages', dir, 'package.json')))
  .map((dir) => JSON.parse(read(`packages/${dir}/package.json`)));

const readmeBullets = () => {
  const match = /^## Packages\n([\s\S]*?)^## /m.exec(read('README.md'));
  if (!match) throw new Error('README.md has no "## Packages" section');
  return [...match[1].matchAll(/^- `([^`]+)` — (.*)$/gm)].map(([, name, text]) => ({ name, text }));
};

describe('package list', () => {
  it('README lists exactly the packages under packages/*', () => {
    expect(
      readmeBullets()
        .map((b) => b.name)
        .sort(),
    ).toEqual(packages.map((p) => p.name).sort());
  });

  it('README marks a package private exactly when package.json does', () => {
    const marked = readmeBullets()
      .filter((b) => b.text.endsWith('(private, not published).'))
      .map((b) => b.name);
    expect(marked.sort()).toEqual(
      packages
        .filter((p) => p.private)
        .map((p) => p.name)
        .sort(),
    );
  });

  it('AGENTS.md points to the README list and keeps no copy of it', () => {
    const lines = read('AGENTS.md').split('\n');
    expect(lines.some((line) => line.includes('README.md#packages'))).toBe(true);
    const copies = lines.filter(
      (line) => packages.filter((p) => line.includes(`\`${p.name}\``)).length >= 2,
    );
    expect(copies).toEqual([]);
  });
});
