import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';

/**
 * Focus return for a modal surface that a consumer unmounts while it is open
 * (`{show && <Dialog defaultOpen>…</Dialog>}`). The browser only gives focus
 * back on `close()`; a removed <dialog> never closes, so ModalSurface must.
 *
 * `modal` is an open modal with a button named "Inside" and a close button
 * named "Close" in it.
 */
export function describeModalFocusReturn(modal: ReactElement) {
  describe('focus return on unmount (#303)', () => {
    function Page({ show }: { show: boolean }) {
      return (
        <>
          <button type="button">Opener</button>
          <input aria-label="Elsewhere" />
          {show ? modal : null}
        </>
      );
    }

    function openFromOpener(wrap: (page: ReactElement) => ReactElement) {
      const view = render(wrap(<Page show={false} />));
      screen.getByRole('button', { name: 'Opener' }).focus();
      view.rerender(wrap(<Page show />));
      // Native showModal() moves focus into the dialog; jsdom's stub does not.
      screen.getByRole('button', { name: 'Inside' }).focus();
      return () => view.rerender(wrap(<Page show={false} />));
    }

    it('gives focus back to the opener', () => {
      const unmountModal = openFromOpener((page) => page);
      unmountModal();
      expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
    });

    it('gives focus back to the opener under StrictMode', () => {
      const unmountModal = openFromOpener((page) => <StrictMode>{page}</StrictMode>);
      expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();
      unmountModal();
      expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
    });

    it('leaves focus alone if something else took it', () => {
      const unmountModal = openFromOpener((page) => page);
      screen.getByLabelText('Elsewhere').focus();
      unmountModal();
      expect(screen.getByLabelText('Elsewhere')).toHaveFocus();
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
