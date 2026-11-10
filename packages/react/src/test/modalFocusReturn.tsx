import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Focus return for a modal surface that a consumer unmounts while it is open
 * (`{show && <Dialog defaultOpen>…</Dialog>}`). The browser only gives focus
 * back on `close()`; a removed <dialog> never closes, so ModalSurface must.
 *
 * `modal` is an open modal whose first focusable element is a button named
 * "Inside", followed by a close button named "Close".
 */
export function describeModalFocusReturn(modal: ReactElement) {
  describe('focus return on unmount (#303)', () => {
    // Act like a browser: showModal() moves focus into the dialog. jsdom's
    // stub (test/setup.ts) only sets `open`, which would hide a restore that
    // fires too early, such as on StrictMode's simulated unmount.
    beforeEach(() => {
      vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function showModal(
        this: HTMLDialogElement,
      ) {
        this.open = true;
        this.querySelector<HTMLElement>('button, input')?.focus();
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function Page({ show, withOpener = true }: { show: boolean; withOpener?: boolean }) {
      return (
        <>
          {withOpener ? <button type="button">Opener</button> : null}
          <input aria-label="Elsewhere" />
          {show ? modal : null}
        </>
      );
    }

    function openFromOpener(wrap: (page: ReactElement) => ReactElement) {
      const view = render(wrap(<Page show={false} />));
      screen.getByRole('button', { name: 'Opener' }).focus();
      view.rerender(wrap(<Page show />));
      expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();
      return (withOpener = true) =>
        view.rerender(wrap(<Page show={false} withOpener={withOpener} />));
    }

    it('gives focus back to the opener', () => {
      const unmountModal = openFromOpener((page) => page);
      unmountModal();
      expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
    });

    it('gives focus back to the opener under StrictMode', () => {
      const unmountModal = openFromOpener((page) => <StrictMode>{page}</StrictMode>);
      unmountModal();
      expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
    });

    // StrictMode runs a mount's cleanup once straight away, with the dialog
    // still on the page. If focus sits on <body> at that moment (a click on a
    // non-focusable part of the dialog does that), the cleanup must still
    // tell it apart from a real unmount and not pull focus behind the modal.
    it('does not move focus while still open under StrictMode', () => {
      vi.mocked(HTMLDialogElement.prototype.showModal).mockImplementation(function showModal(
        this: HTMLDialogElement,
      ) {
        this.open = true;
        (document.activeElement as HTMLElement | null)?.blur();
      });
      render(
        <StrictMode>
          <Page show={false} />
        </StrictMode>,
      );
      screen.getByRole('button', { name: 'Opener' }).focus();
      render(<StrictMode>{modal}</StrictMode>);
      expect(document.body).toHaveFocus();
    });

    it('leaves focus alone if something else took it', () => {
      const unmountModal = openFromOpener((page) => page);
      screen.getByLabelText('Elsewhere').focus();
      unmountModal();
      expect(screen.getByLabelText('Elsewhere')).toHaveFocus();
    });

    it('does not throw or move focus if the opener left the page', () => {
      const unmountModal = openFromOpener((page) => page);
      expect(() => unmountModal(false)).not.toThrow();
      expect(document.body).toHaveFocus();
    });

    it('does nothing when a modal that already closed is unmounted', () => {
      const unmountModal = openFromOpener((page) => page);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      (document.activeElement as HTMLElement | null)?.blur();
      unmountModal();
      expect(document.body).toHaveFocus();
    });
  });
}
