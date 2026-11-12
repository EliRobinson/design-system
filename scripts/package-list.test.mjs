// README.md "Packages" is the one list of workspace packages. AGENTS.md points
// to it instead of repeating names, so a new package needs one edit, not two.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const names = readdirSync(join(root, 'packages')).map(
  (dir) => JSON.parse(read(`packages/${dir}/package.json`)).name,
);

const readmeSection = () => {
  const match = /^## Packages\n([\s\S]*?)^## /m.exec(read('README.md'));
  if (!match) throw new Error('README.md has no "## Packages" section');
  return match[1];
};

describe('package list', () => {
  it('README lists every workspace package', () => {
    const section = readmeSection();
    const missing = names.filter((name) => !section.includes(`\`${name}\``));
    expect(missing).toEqual([]);
  });

  it('README lists no package that does not exist', () => {
    const listed = [...readmeSection().matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]);
    expect(listed.filter((name) => !names.includes(name))).toEqual([]);
  });

  it('AGENTS.md points to the README list and keeps no copy of it', () => {
    const intro = read('AGENTS.md').split('\n')[2];
    expect(intro).toContain('README.md#packages');
    expect(names.filter((name) => intro.includes(name))).toEqual([]);
  });
});
