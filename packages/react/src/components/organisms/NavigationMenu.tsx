import type { HTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn.js';

export type NavigationMenuItem = {
  label: string;
  /**
   * Omit to render a non-interactive group label instead of a link -- for a
   * section heading like "FOUNDATIONS" that names its nested items but is not
   * itself a page. A label is never focusable and never marked current.
   */
  href?: string;
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
// asked for. Every navigable item renders as a real <a>, so Tab/Shift+Tab
// already walk the whole tree (including nested items) in document order with
// zero extra code -- the same reasoning SegmentedControl and Accordion's
// trigger give for skipping roving-tabindex/arrow-key handling: that pattern
// exists for widgets with a single roving tab stop, which a list of anchors is
// not.
//
// An item with no href is a group label, not a link, so it renders as a <span>:
// unfocusable, not a navigation target, and -- since active state is keyed off
// href -- impossible to mark as the current page. That last part is the point.
// A section header handed its first child's href (the only way to satisfy a
// required href) lights up as current whenever that child is open, and emits a
// second aria-current="page" beside the real one.
//
// A label also names the list beneath it via aria-labelledby, so descending
// into the group announces "Foundations, list, 7 items" instead of an anonymous
// "list, 7 items". Only labels do this: a link parent is a page in its own
// right, not a title for the list under it.
function NavigationMenuList({
  items,
  currentPath,
  labelledBy,
}: {
  items: NavigationMenuItem[];
  currentPath?: string;
  labelledBy?: string;
}) {
  // One base id per list; each label derives its own from the item's position,
  // which is stable for a given `items` array. useId can't be called in the
  // map -- hooks don't run in loops.
  const listId = useId();

  return (
    <ul className="ds-navigation-menu__list" aria-labelledby={labelledBy}>
      {items.map((item, index) => {
        const isActive = item.href !== undefined && item.href === currentPath;
        const labelId = item.href === undefined ? `${listId}-${index}` : undefined;
        return (
          <li key={item.href ?? item.label}>
            {labelId !== undefined ? (
              <span id={labelId} className="ds-navigation-menu__label">
                {item.label}
              </span>
            ) : (
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
            )}
            {item.items && item.items.length > 0 ? (
              <NavigationMenuList
                items={item.items}
                currentPath={currentPath}
                labelledBy={labelId}
              />
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
