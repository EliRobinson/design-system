// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SiteMenu } from './SiteMenu';

const nav = vi.hoisted(() => ({ pathname: '/components/button' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
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
  { label: 'GitHub', href: 'https://github.com/EliRobinson/design-system', external: true },
];

/* jsdom has no <dialog> modality. Act like a browser: showModal() moves focus
   into the dialog; close() fires `close` (which is also what Escape does) and
   hands focus back to what had it before. The component does not move focus
   itself, so this is the behaviour under test. */
beforeEach(() => {
  let opener: Element | null = null;
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    opener = document.activeElement;
    this.open = true;
    this.querySelector<HTMLElement>('a, button')?.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    (opener as HTMLElement | null)?.focus();
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

  it('closes when the browser closes the dialog (Escape), and focus returns to the button', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(menuButton());

    // Escape makes the browser close the modal dialog; jsdom has no keyboard
    // handling for it, so the test does what the browser does.
    (screen.getByRole('dialog') as HTMLDialogElement).close();

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(menuButton()).toHaveFocus();
  });

  it('closes when the route changes without a click in the sheet', async () => {
    const user = userEvent.setup();
    const view = renderMenu();
    await user.click(menuButton());
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    nav.pathname = '/components/card'; // browser back or forward
    view.rerender(<SiteMenu sections={SECTIONS} links={LINKS} />);

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    nav.pathname = '/components/button';
  });

  it('stays open when a link is opened in a new tab', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(menuButton());
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Introduction' }));
    await user.keyboard('{/Control}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
