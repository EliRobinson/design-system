'use client';

import { usePathname } from 'next/navigation';

import { NavigationMenu } from '@elirobinson/react/components/organisms/NavigationMenu';

export type SidebarSection = {
  title: string;
  pages: { title: string; href: string }[];
};

/* The docs navigation tree. The sidebar shows it at 960px and up; SiteMenu
   shows the same tree in a Sheet below that. One component, so the two cannot
   list different pages. */
export function SiteNav({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname();

  return (
    <NavigationMenu
      aria-label="Documentation"
      currentPath={pathname}
      // Section titles are headings, not pages -- no href, so NavigationMenu
      // renders them as inert labels. Giving one its first page's href made
      // that page's section header render as current alongside the page.
      items={sections.map((section) => ({
        label: section.title,
        items: section.pages.map((page) => ({ label: page.title, href: page.href })),
      }))}
    />
  );
}

export function SiteSidebar({ sections }: { sections: SidebarSection[] }) {
  return (
    <aside className="site-sidebar">
      <SiteNav sections={sections} />
    </aside>
  );
}
