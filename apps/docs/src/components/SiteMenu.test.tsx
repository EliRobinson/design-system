// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SiteMenu } from './SiteMenu';

vi.mock('next/navigation', () => ({ usePathname: () => '/components/button' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

const SECTIONS = [
  { title: 'Overview', pages: [{ title: 'Introduction', href: '/' }] },
  { title: 'Atoms', pages: [{ title: 'Button', href: '/components/button' }] },
];
const LINKS = [
  { label: 'Foundations', href: '/foundations/color' },
  { label: 'GitHub', href: 'https://github.com/EliRobinson/design-system' },
];

/* jsdom has no <dialog> modality. Act like a browser: showModal() moves focus
   into the dialog, close() fires `close`, which is also what Escape does. */
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
    this.querySelector<HTMLElement>('a, button')?.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(cleanup);

const renderMenu = () => render(<SiteMenu sections={SECTIONS} links={LINKS} />);
const menuButton = () => screen.getByRole('button', { name: 'Menu' });

describe('SiteMenu (#370)', () => {
  it('shows a closed menu button', () => {
    renderMenu();
    expect(menuButton()).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a Sheet with the sidebar navigation and the header links', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(menuButton());

    const dialog = screen.getByRole('dialog');
    const docs = within(dialog).getByRole('navigation', { name: 'Documentation' });
    expect(within(docs).getByRole('link', { name: 'Introduction' })).toHaveAttribute('href', '/');
    expect(within(docs).getByRole('link', { name: 'Button' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(dialog).getByRole('link', { name: 'Foundations' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
  });

  it('closes when a link is followed, and focus returns to the button', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(menuButton());
    await user.click(screen.getByRole('link', { name: 'Introduction' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  it('closes on Escape, and focus returns to the button', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(menuButton());

    // The browser answers Escape by closing the modal dialog natively.
    (screen.getByRole('dialog') as HTMLDialogElement).close();

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(menuButton()).toHaveFocus();
  });
});
