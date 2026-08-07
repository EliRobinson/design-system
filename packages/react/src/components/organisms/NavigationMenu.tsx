import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export type NavigationMenuItem = {
  label: string;
  href: string;
  items?: NavigationMenuItem[];
};

export type NavigationMenuProps = HTMLAttributes<HTMLElement> & {
  items: NavigationMenuItem[];
  currentPath?: string;
};

// Nested items are a plain, always-rendered sub-list -- not a collapsible
// disclosure widget. There is no trigger to expand/collapse, so this
// deliberately has no aria-expanded/aria-controls and no Escape handling:
// that machinery belongs to a toggleable submenu, which this brief does not
// ask for. Inventing it here would add undocumented behavior no consumer
// asked for. Every item renders as a real <a>, so Tab/Shift+Tab already walk
// the whole tree (including nested items) in document order with zero extra
// code -- the same reasoning SegmentedControl and Accordion's trigger give
// for skipping roving-tabindex/arrow-key handling: that pattern exists for
// widgets with a single roving tab stop, which a list of anchors is not.
function NavigationMenuList({
  items,
  currentPath,
}: {
  items: NavigationMenuItem[];
  currentPath?: string;
}) {
  return (
    <ul className="ds-navigation-menu__list">
      {items.map((item) => {
        const isActive = item.href === currentPath;
        return (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'ds-navigation-menu__link',
                isActive && 'ds-navigation-menu__link--active',
              )}
            >
              {item.label}
            </a>
            {item.items && item.items.length > 0 ? (
              <NavigationMenuList items={item.items} currentPath={currentPath} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// Nothing on <nav> is internally computed -- no hardcoded role, id, or aria-*
// for a consumer to clobber via `{...props}` -- so unlike AccordionTrigger or
// TabsTrigger this props type needs no protective Omit.
export const NavigationMenu = forwardRef<HTMLElement, NavigationMenuProps>(function NavigationMenu(
  { className, items, currentPath, ...props },
  ref,
) {
  return (
    <nav ref={ref} className={cn('ds-navigation-menu', className)} {...props}>
      <NavigationMenuList items={items} currentPath={currentPath} />
    </nav>
  );
});
