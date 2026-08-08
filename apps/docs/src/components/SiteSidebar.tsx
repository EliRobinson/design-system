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
        items={sections.map((section) => ({
          label: section.title,
          href: section.pages[0]?.href ?? '/',
          items: section.pages.map((page) => ({ label: page.title, href: page.href })),
        }))}
      />
    </aside>
  );
}
