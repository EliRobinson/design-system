import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { derivedSection, parsePageMetadata, siteSections } from './site-map';

const fixtures: string[] = [];
afterAll(() => {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'site-map-'));
  fixtures.push(dir);
  return dir;
}

function page(root: string, dir: string, metadata: string) {
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, 'page.mdx'), `export const metadata = ${metadata};\n\n# Page\n`);
}

describe('derivedSection', () => {
  it('builds a section from the page files on disk, in explicit metadata order', () => {
    const root = fixtureDir();
    page(root, 'beta', "{ title: 'Beta pattern', navTitle: 'Beta', order: 2 }");
    page(root, 'alpha', "{ title: 'Alpha', order: 1 }");
    mkdirSync(join(root, 'no-page'), { recursive: true });

    expect(derivedSection('Things', root, '/things')).toEqual({
      title: 'Things',
      pages: [
        { title: 'Alpha', href: '/things/alpha' },
        { title: 'Beta', href: '/things/beta' },
      ],
    });
  });

  it('includes a page.mdx at the section root, ordered with the rest', () => {
    /* AI Elements' root page is the generated component index and its prose
       pages hang off it, so the section's own href is a page of the section.
       Ordered by its metadata like everything else rather than pinned first:
       the index is second there, behind the overview. */
    const root = fixtureDir();
    writeFileSync(
      join(root, 'page.mdx'),
      "export const metadata = { title: 'Index', order: 2 };\n\n# Page\n",
    );
    page(root, 'intro', "{ title: 'Intro', order: 1 }");

    expect(derivedSection('Things', root, '/things')).toEqual({
      title: 'Things',
      pages: [
        { title: 'Intro', href: '/things/intro' },
        { title: 'Index', href: '/things' },
      ],
    });
  });

  it('throws, naming the file, when a page has no order', () => {
    const root = fixtureDir();
    page(root, 'gamma', "{ title: 'Gamma' }");
    expect(() => derivedSection('Things', root, '/things')).toThrow(/gamma/);
  });

  it('throws, naming the file, when a page has no metadata at all', () => {
    const root = fixtureDir();
    mkdirSync(join(root, 'delta'), { recursive: true });
    writeFileSync(join(root, 'delta', 'page.mdx'), '# No metadata here\n');
    expect(() => derivedSection('Things', root, '/things')).toThrow(/delta/);
  });
});

describe('parsePageMetadata', () => {
  it('reads title, navTitle, and order from a typed metadata export', () => {
    expect(
      parsePageMetadata(
        "export const metadata: Metadata = { title: 'It\\'s here', navTitle: 'Here', order: 7 };",
        'x/page.mdx',
      ),
    ).toEqual({ title: "It's here", navTitle: 'Here', order: 7 });
  });
});

describe('siteSections', () => {
  it('keeps the section spine the corpus and the header address by title', () => {
    expect(siteSections().map((s) => s.title)).toEqual([
      'Overview',
      'Foundations',
      'AI',
      'Atoms',
      'Molecules',
      'Organisms',
      'Components',
      'AI Elements',
      'Patterns',
      'Guidelines',
      'Brand',
      'UI Kits',
      'Resources',
      'Build with AI',
    ]);
  });
});
