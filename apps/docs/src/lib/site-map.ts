/* The site's page registry — the one section list. The sidebar, the header
   nav, the homepage cards, the command-palette search, and the AI corpus
   ordering all derive from this. Component entries come from the generated
   manifest, and the Foundations, Patterns, and Guidelines sections from the
   page files on disk — never a hand-kept list, which existed in three copies
   and drifted in all of them. */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { kitSlug, uiKits } from './brand';
import { TIERS, components, type Tier } from './manifest';

export type SitePage = {
  title: string;
  href: string;
};

export type SiteSection = {
  title: string;
  pages: SitePage[];
};

const APP_DIR = join(process.cwd(), 'src/app/(docs)');

/* Tier names come from the package's own directory layout, so the label is
   derived rather than looked up — a new tier gets a sidebar section without an
   edit here.

   Acronyms are the one exception, and they are named rather than guessed at:
   title-casing `ai` gives "Ai", which reads as a typo rather than as a label,
   and no rule short of a dictionary distinguishes an acronym from a word. A
   tier missing from this set still gets a section; it just gets the wrong
   capitalisation, which is a review comment and not an outage. */
const ACRONYM_TIERS = new Set<string>(['ai']);

function tierLabel(tier: Tier): string {
  return ACRONYM_TIERS.has(tier)
    ? tier.toUpperCase()
    : tier.charAt(0).toUpperCase() + tier.slice(1);
}

type PageMetadata = {
  title: string;
  navTitle?: string;
  order: number;
};

/* Parsed out of the page source rather than imported: MDX modules need a
   bundler, and this module also runs under vitest and plain node. */
export function parsePageMetadata(source: string, file: string): PageMetadata {
  const object = source.match(/export const metadata(?::\s*[\w.]+)?\s*=\s*\{([\s\S]*?)\};/)?.[1];
  if (object === undefined) {
    throw new Error(`${file} exports no metadata — a page in a derived section needs one.`);
  }
  const literal = (key: string) =>
    object.match(new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`))?.[1].replace(/\\'/g, "'");
  const title = literal('title');
  const navTitle = literal('navTitle');
  const order = object.match(/order:\s*(\d+)/)?.[1];
  if (title === undefined) {
    throw new Error(`${file} metadata has no title.`);
  }
  if (order === undefined) {
    throw new Error(
      `${file} metadata has no order — a page's position in the sidebar is explicit, ` +
        `not directory listing order.`,
    );
  }
  return { title, navTitle, order: Number(order) };
}

/* A section whose pages are whatever page.mdx files exist under one
   directory, ordered by their metadata's explicit `order` — adding a page to
   the section is adding one file. */
export function derivedSection(title: string, dir: string, hrefBase: string): SiteSection {
  /* A `page.mdx` at the section root is a page of the section like any other:
     `hrefBase` itself, ordered by its own metadata rather than pinned to the
     front. Sections that have no such file are unaffected, which is all of them
     but AI Elements — whose root page is the generated component index, and
     whose prose pages hang off it. Without this the one route a section is
     named after would be the one route missing from the sidebar, and
     site-structure.test.ts's "reach every page that exists on disk" would fail
     on it, correctly. */
  const rootPage = existsSync(join(dir, 'page.mdx'))
    ? [{ name: '', file: join(dir, 'page.mdx') }]
    : [];
  const pages = [
    ...rootPage,
    ...readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'page.mdx')))
      .map((entry) => ({ name: entry.name, file: join(dir, entry.name, 'page.mdx') })),
  ]
    .map(({ name, file }) => {
      const metadata = parsePageMetadata(readFileSync(file, 'utf8'), file);
      return {
        title: metadata.navTitle ?? metadata.title,
        href: name === '' ? hrefBase : `${hrefBase}/${name}`,
        order: metadata.order,
      };
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map(({ title: pageTitle, href }) => ({ title: pageTitle, href }));
  return { title, pages };
}

export function siteSections(): SiteSection[] {
  return [
    {
      title: 'Overview',
      pages: [
        { title: 'Introduction', href: '/' },
        { title: 'Installation', href: '/installation' },
        { title: 'Adopting the system', href: '/adoption' },
      ],
    },
    derivedSection('Foundations', join(APP_DIR, 'foundations'), '/foundations'),
    ...TIERS.map((tier) => ({
      title: tierLabel(tier),
      pages: components
        .filter((c) => c.tier === tier)
        .map((c) => ({ title: c.name, href: `/components/${c.slug}` })),
    })),
    {
      /* Both pages here are page.tsx, not page.mdx — they render from the
         manifest — so they are listed rather than derived. */
      title: 'Components',
      pages: [
        { title: 'All components', href: '/components' },
        { title: 'Interaction hooks', href: '/components/hooks' },
      ],
    },
    /* The vendored tier, next to the components it sits beside in the URL
       space rather than off in a section of its own. Derived like Patterns and
       Guidelines, and deliberately not a component-per-page section: the roster
       belongs to vercel/ai-elements, so the one page that names components is
       generated from the manifest.

       A separate sidebar heading under /components, not a merge into the
       Components section above: it is a second package with a Tailwind 4
       requirement the first one does not have, and a reader has to be able to
       see which of the two they are looking at. Where the tier boundary
       eventually puts it is P1's question, not this section list's. */
    derivedSection(
      'AI Elements',
      join(APP_DIR, 'components/ai-elements'),
      '/components/ai-elements',
    ),
    derivedSection('Patterns', join(APP_DIR, 'patterns'), '/patterns'),
    derivedSection('Guidelines', join(APP_DIR, 'guidelines'), '/guidelines'),
    {
      /* Rendered from the brand manifest — page.tsx routes, so listed here
         rather than derived from page.mdx files. */
      title: 'Brand',
      pages: [
        { title: 'Guidelines', href: '/brand/guidelines' },
        { title: 'Assets', href: '/brand/assets' },
      ],
    },
    {
      title: 'UI Kits',
      pages: uiKits().map((kit) => ({
        title: kit.title.replace(/\s*UI Kit$/i, ''),
        href: `/brand/ui-kits/${kitSlug(kit)}`,
      })),
    },
    {
      title: 'Resources',
      pages: [
        { title: 'Slides', href: '/brand/slides' },
        { title: 'Patterns', href: '/brand/patterns' },
      ],
    },
    {
      title: 'Build with AI',
      pages: [{ title: 'Build with AI', href: '/build-with-ai' }],
    },
  ];
}

/** The first page of a named section — loud when the section moves or renames. */
export function firstPageOf(sectionTitle: string): SitePage {
  const sections = siteSections();
  const section = sections.find((s) => s.title === sectionTitle);
  if (!section || section.pages.length === 0) {
    throw new Error(
      `No section titled "${sectionTitle}" with pages. ` +
        `Sections: ${sections.map((s) => s.title).join(', ')}.`,
    );
  }
  return section.pages[0];
}

/** A page looked up by its title — loud when the page moves or renames. */
export function pageByTitle(title: string): SitePage {
  const page = allPages().find((p) => p.title === title);
  if (!page) {
    throw new Error(`No page titled "${title}" in any site section.`);
  }
  return page;
}

/** Flat list for search — every page on the site. */
export function allPages(): { title: string; section: string; href: string }[] {
  return siteSections().flatMap((section) =>
    section.pages.map((page) => ({
      title: page.title,
      section: section.title,
      href: page.href,
    })),
  );
}
