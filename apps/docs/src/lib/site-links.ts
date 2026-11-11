import { firstPageOf } from './site-map';

export const REPO_URL = 'https://github.com/EliRobinson/design-system';

export type SiteLink = { label: string; href: string; external?: boolean };

/* Which sections get a top-level entry is editorial; where each one points
   derives from the section list, so the hrefs cannot drift from it. The header
   nav and the mobile menu both render from this list. */
const NAV_SECTIONS = ['Foundations', 'Components', 'Patterns', 'Guidelines', 'Build with AI'];

export const SECTION_LINKS: SiteLink[] = NAV_SECTIONS.map((label) => ({
  label,
  href: firstPageOf(label).href,
}));

export const GITHUB_LINK: SiteLink = { label: 'GitHub', href: REPO_URL, external: true };
