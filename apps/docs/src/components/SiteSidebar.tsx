'use client';

import { usePathname } from 'next/navigation';

import { NavigationMenu } from '@elirobinson/react/components/organisms/NavigationMenu';

type SidebarSection = {
  title: string;
  pages: { title: string; href: string }[];
};

export function SiteSidebar({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname();

  return (
    <aside className="site-sidebar">
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
    </aside>
  );
}
