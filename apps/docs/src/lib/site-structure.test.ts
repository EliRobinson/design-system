/* Structural drift guards: the gap between "a package changed" and "the site
   is correct". Everything here checks the filesystem or the page sources
   against the manifest — never one derivation of the manifest against
   another, which is the tautology these tests replace. */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { components } from './manifest';
import { allPages } from './site-map';

const APP_DIR = join(process.cwd(), 'src/app');
const DOCS_DIR = join(APP_DIR, '(docs)');

/** Every route served by a page file under src/app/(docs). Dynamic segments
    are skipped — their reachability is generateStaticParams' business, and
    the build's static-routes assertion already fails an unprerendered one. */
function pageRoutesOnDisk(dir = DOCS_DIR, route = ''): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('[')) {
      routes.push(...pageRoutesOnDisk(join(dir, entry.name), `${route}/${entry.name}`));
    } else if (entry.name === 'page.mdx' || entry.name === 'page.tsx') {
      routes.push(route === '' ? '/' : route);
    }
  }
  return routes;
}

/** Every page file under src/app — MDX and TSX alike, including the homepage. */
function pageFilesOnDisk(dir = APP_DIR): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...pageFilesOnDisk(join(dir, entry.name)));
    } else if (entry.name === 'page.mdx' || entry.name === 'page.tsx') {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function pageFileFor(href: string): string | null {
  if (href === '/') {
    return existsSync(join(APP_DIR, 'page.tsx')) ? join(APP_DIR, 'page.tsx') : null;
  }
  /* Each path segment may be satisfied by a literal directory or by a dynamic
     [param] directory — /brand/ui-kits/marketing is served by [kit]/. */
  let dirs = [DOCS_DIR];
  for (const segment of href.slice(1).split('/')) {
    dirs = dirs.flatMap((dir) => {
      const literal = join(dir, segment);
      const next = existsSync(literal) ? [literal] : [];
      const dynamic = existsSync(dir)
        ? readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && /^\[.+\]$/.test(entry.name))
            .map((entry) => join(dir, entry.name))
        : [];
      return [...next, ...dynamic];
    });
  }
  for (const dir of dirs) {
    for (const page of ['page.mdx', 'page.tsx']) {
      if (existsSync(join(dir, page))) {
        return join(dir, page);
      }
    }
  }
  return null;
}

describe('site sections', () => {
  it('link only to pages that exist on disk', () => {
    for (const page of allPages()) {
      expect(pageFileFor(page.href), `${page.section} → ${page.href}`).not.toBeNull();
    }
  });

  it('reach every page that exists on disk', () => {
    /* A page absent from the sections is invisible to the sidebar AND to
       command-palette search, which builds its index from allPages(). */
    const hrefs = new Set(allPages().map((page) => page.href));
    for (const route of pageRoutesOnDisk()) {
      expect(hrefs.has(route), `${route} has a page file but no section entry`).toBe(true);
    }
  });
});

describe('hand-written references', () => {
  it('reference only real component slugs in RelatedComponents', () => {
    /* RelatedComponents silently .filter()s out unknown slugs, so a renamed
       component quietly empties the related list at render time. */
    const slugs = new Set(components.map((c) => c.slug));
    let references = 0;
    for (const c of components) {
      const source = readFileSync(join(DOCS_DIR, 'components', c.slug, 'page.mdx'), 'utf8');
      for (const block of source.matchAll(/<RelatedComponents\s+slugs=\{\[([\s\S]*?)\]\}/g)) {
        for (const [, slug] of block[1].matchAll(/'([^']+)'/g)) {
          references += 1;
          expect(slugs.has(slug), `${c.slug}/page.mdx references unknown component "${slug}"`).toBe(
            true,
          );
        }
      }
    }
    /* If the extraction regex rots, fail loudly instead of silently
       checking nothing. */
    expect(references).toBeGreaterThan(100);
  });
});

describe('counts derive from source', () => {
  it('never hardcodes an inventory count into page prose', () => {
    /* "44 components", "6 interaction hooks", "~120 tokens" — every one was
       wrong within a release of being written. Derive from the manifest
       (components.length, hooks.length, cssTokens().length) instead. */
    const inventory =
      /~?\d+(?:\s|-|–|&nbsp;)+(?:components?|interaction hooks?|hooks|design tokens|tokens|published packages|packages)\b/i;
    for (const file of pageFilesOnDisk()) {
      const match = readFileSync(file, 'utf8').match(inventory);
      expect(
        match?.[0],
        `${file.replace(APP_DIR, 'src/app')} states an inventory count — derive it instead`,
      ).toBeUndefined();
    }
  });

  it('derives every homepage stat rather than stating one', () => {
    const source = readFileSync(join(APP_DIR, 'page.tsx'), 'utf8');
    expect(source).not.toMatch(/value:\s*\d/);
  });
});
