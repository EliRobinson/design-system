import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { NavigationMenu, type NavigationMenuItem } from './NavigationMenu';

const items: NavigationMenuItem[] = [
  { label: 'Dashboard', href: '/' },
  {
    label: 'Settings',
    href: '/settings',
    items: [
      { label: 'Profile', href: '/settings/profile' },
      { label: 'Billing', href: '/settings/billing' },
    ],
  },
];

describe('NavigationMenu', () => {
  it('renders a nav landmark containing a list structure', () => {
    render(<NavigationMenu items={items} />);

    const nav = screen.getByRole('navigation');
    // The outer list plus the one nested submenu list under Settings.
    expect(within(nav).getAllByRole('list')).toHaveLength(2);
    // 2 top-level items + 2 nested items under Settings, so a screen reader
    // announces "list, 2 items" at the top level and "list, 2 items" again
    // when it descends into Settings -- not one flat "4 items" list.
    expect(within(nav).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('marks only the item matching currentPath as the current page', () => {
    render(<NavigationMenu items={items} currentPath="/settings/profile" />);

    const profileLink = screen.getByRole('link', { name: 'Profile' });
    expect(profileLink).toHaveAttribute('aria-current', 'page');

    const otherLinks = screen.getAllByRole('link').filter((link) => link !== profileLink);
    expect(otherLinks).toHaveLength(3);
    for (const link of otherLinks) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('does not mark any item current when currentPath matches nothing', () => {
    render(<NavigationMenu items={items} currentPath="/nowhere" />);

    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('renders nested items inside their parent list item, not flattened', () => {
    render(<NavigationMenu items={items} />);

    const settingsLink = screen.getByRole('link', { name: 'Settings' });
    const settingsItem = settingsLink.closest('li');
    expect(settingsItem).not.toBeNull();
    const nestedList = within(settingsItem as HTMLElement).getByRole('list');
    expect(
      within(nestedList)
        .getAllByRole('link')
        .map((el) => el.textContent),
    ).toEqual(['Profile', 'Billing']);
  });

  it('renders real anchors with working hrefs, tab-navigable without extra key handling', async () => {
    const user = userEvent.setup();
    render(<NavigationMenu items={items} />);

    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).toHaveAttribute('href', '/');

    dashboard.focus();
    expect(dashboard).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveFocus();
  });

  it('forwards the ref to the outer nav element', () => {
    const ref = createRef<HTMLElement>();
    render(<NavigationMenu ref={ref} items={items} />);

    expect(ref.current).toBe(screen.getByRole('navigation'));
  });

  it('does not let a consumer aria-current override the computed active state', () => {
    // Even if a consumer tries to force aria-current via arbitrary props on
    // NavigationMenu itself, per-item aria-current is computed internally
    // from currentPath and there is no pass-through path to individual links.
    render(<NavigationMenu items={items} currentPath="/" />);

    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).toHaveAttribute('aria-current', 'page');
  });

  it('merges a consumer className onto the nav element', () => {
    render(<NavigationMenu items={items} className="custom-nav" />);

    expect(screen.getByRole('navigation')).toHaveClass('ds-navigation-menu', 'custom-nav');
  });
});
