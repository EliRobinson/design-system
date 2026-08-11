/* The site's page registry. The sidebar, the command-palette search, and the
   AI corpus ordering all derive from this — component entries come from the
   generated manifest, never a hand-kept list. */

import { TIERS, components, type Tier } from './manifest';

export type SitePage = {
  title: string;
  href: string;
};

export type SiteSection = {
  title: string;
  pages: SitePage[];
};

/* Tier names come from the package's own directory layout, so the label is
   derived rather than looked up — a new tier gets a sidebar section without an
   edit here. */
function tierLabel(tier: Tier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
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
    {
      title: 'Foundations',
      pages: [
        { title: 'Color', href: '/foundations/color' },
        { title: 'Typography', href: '/foundations/typography' },
        { title: 'Spacing', href: '/foundations/spacing' },
        { title: 'Radii and elevation', href: '/foundations/radii-elevation' },
        { title: 'Motion', href: '/foundations/motion' },
        { title: 'Accessibility', href: '/foundations/accessibility' },
      ],
    },
    ...TIERS.map((tier) => ({
      title: tierLabel(tier),
      pages: components
        .filter((c) => c.tier === tier)
        .map((c) => ({ title: c.name, href: `/components/${c.slug}` })),
    })),
    {
      title: 'Hooks',
      pages: [{ title: 'Interaction hooks', href: '/components/hooks' }],
    },
    {
      title: 'Patterns',
      pages: [
        { title: 'Header', href: '/patterns/header' },
        { title: 'Footer', href: '/patterns/footer' },
        { title: 'Hero', href: '/patterns/hero' },
        { title: 'Sidebar', href: '/patterns/sidebar' },
        { title: 'Top bar', href: '/patterns/top-bar' },
        { title: 'Form layout', href: '/patterns/forms' },
        { title: 'Data display', href: '/patterns/data-display' },
      ],
    },
    {
      title: 'Guidelines',
      pages: [
        { title: 'Voice and content', href: '/guidelines/voice' },
        { title: 'Accessibility standard', href: '/guidelines/accessibility' },
        { title: 'The tier boundary', href: '/guidelines/tiers' },
        { title: 'Contributing a component', href: '/guidelines/contributing' },
      ],
    },
    {
      title: 'Build with AI',
      pages: [{ title: 'Build with AI', href: '/build-with-ai' }],
    },
  ];
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
