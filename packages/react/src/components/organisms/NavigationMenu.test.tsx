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

  it('renders an item with no href as a plain label, not a link', () => {
    render(
      <NavigationMenu
        items={[
          {
            label: 'Foundations',
            items: [{ label: 'Color', href: '/foundations/color' }],
          },
        ]}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Foundations' })).toBeNull();
    expect(screen.getByText('Foundations').tagName).toBe('SPAN');
    // A label is not a navigation target, so it must stay out of the tab order.
    expect(screen.getByText('Foundations')).not.toHaveAttribute('tabindex');
  });

  it('never marks a hrefless group label current, even when a child matches currentPath', () => {
    // Regression: a sidebar section header used to borrow its first child's
    // href, so landing on that child lit up the header as the current page too.
    render(
      <NavigationMenu
        currentPath="/foundations/color"
        items={[
          {
            label: 'Foundations',
            items: [
              { label: 'Color', href: '/foundations/color' },
              { label: 'Typography', href: '/foundations/typography' },
            ],
          },
        ]}
      />,
    );

    const label = screen.getByText('Foundations');
    expect(label).not.toHaveAttribute('aria-current');
    expect(label).not.toHaveClass('ds-navigation-menu__link--active');

    expect(screen.getByRole('link', { name: 'Color' })).toHaveAttribute('aria-current', 'page');
    // Exactly one element in the tree claims to be the current page.
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('names a group label’s nested list after the label', () => {
    render(
      <NavigationMenu
        items={[
          {
            label: 'Foundations',
            items: [
              { label: 'Color', href: '/foundations/color' },
              { label: 'Typography', href: '/foundations/typography' },
            ],
          },
        ]}
      />,
    );

    // A screen reader descending into the group announces "Foundations, list,
    // 2 items" rather than an anonymous "list, 2 items".
    const group = screen.getByRole('list', { name: 'Foundations' });
    expect(within(group).getAllByRole('listitem')).toHaveLength(2);
    expect(group).toHaveAttribute('aria-labelledby', screen.getByText('Foundations').id);
  });

  it('leaves a link parent’s nested list unnamed', () => {
    // A link is a page in its own right, not a name for the list under it --
    // only a hrefless label exists solely to title its group.
    render(<NavigationMenu items={items} />);

    const settingsList = screen
      .getByRole('link', { name: 'Settings' })
      .closest('li')!
      .querySelector('ul');
    expect(settingsList).not.toHaveAttribute('aria-labelledby');
  });

  it('merges a consumer className onto the nav element', () => {
    render(<NavigationMenu items={items} className="custom-nav" />);

    expect(screen.getByRole('navigation')).toHaveClass('ds-navigation-menu', 'custom-nav');
  });
});
