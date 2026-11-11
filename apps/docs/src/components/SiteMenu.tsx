'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@elirobinson/react/components/organisms/Sheet';

import type { SiteLink } from '../lib/site-links';
import { SiteNav } from './SiteSidebar';
import type { SidebarSection } from './SiteSidebar';

/* Below 960px the sidebar and the header links are hidden (#370). This menu
   carries both, so a phone reader is not left with Search as the only way to
   move around. */
export function SiteMenu({ sections, links }: { sections: SidebarSection[]; links: SiteLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Browser back and forward change the route without a click in the sheet.
  useEffect(() => setOpen(false), [pathname]);

  // Following a link closes the sheet, the current page's link included: that
  // one does not change the route, so nothing else would close it. A modified
  // click opens a new tab and leaves this page where it is. Focus goes back to
  // the menu button through the Sheet's own focus return.
  function onNavigate(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="site-menu-button" aria-label="Menu">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </SheetTrigger>
      <SheetContent side="left" className="site-menu">
        <SheetHeader className="site-menu__header">
          <SheetTitle>Menu</SheetTitle>
          <SheetClose className="site-menu__close" aria-label="Close menu">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </SheetClose>
        </SheetHeader>
        <div className="site-menu__body" onClick={onNavigate}>
          <nav aria-label="Site" className="site-menu__links">
            {links.map((link) =>
              link.external ? (
                <a key={link.href} href={link.href} rel="noreferrer" className="site-menu__link">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className="site-menu__link">
                  {link.label}
                </Link>
              ),
            )}
          </nav>
          <SiteNav sections={sections} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
