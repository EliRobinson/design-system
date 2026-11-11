'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@elirobinson/react/components/organisms/Sheet';

import { SiteNav } from './SiteSidebar';
import type { SidebarSection } from './SiteSidebar';

type MenuLink = { label: string; href: string };

/* Below 960px the sidebar and the header links are hidden (#370). This menu
   carries both, so a phone reader is not left with Search as the only way to
   move around. */
export function SiteMenu({ sections, links }: { sections: SidebarSection[]; links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    // A native <dialog> hands focus back on close(); say it here as well so it
    // does not depend on which way the sheet was closed.
    if (!next) buttonRef.current?.focus();
  }

  // Following any link closes the sheet, the current page's link included:
  // that one does not change the route, so nothing else would close it.
  function onNavigate(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('a')) onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger ref={buttonRef} className="site-menu-button" aria-label="Menu">
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
        <SheetHeader>
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
              link.href.startsWith('/') ? (
                <Link key={link.href} href={link.href} className="site-header__link">
                  {link.label}
                </Link>
              ) : (
                <a key={link.href} href={link.href} rel="noreferrer" className="site-header__link">
                  {link.label}
                </a>
              ),
            )}
          </nav>
          <div className="site-sidebar site-sidebar--menu">
            <SiteNav sections={sections} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
