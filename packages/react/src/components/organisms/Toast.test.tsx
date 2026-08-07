import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Toaster, useToast } from './Toast';

function ToastTrigger() {
  const { toast } = useToast();

  return (
    <button
      type="button"
      onClick={() => toast({ title: 'Saved', description: 'All changes kept' })}
    >
      Notify
    </button>
  );
}

describe('Toaster', () => {
  it('mounts the portal viewport on the client', () => {
    const { baseElement } = render(<Toaster />);

    expect(baseElement.querySelector('.ds-toast-viewport')).not.toBeNull();
  });

  it('shows a toast raised through the context', async () => {
    const user = userEvent.setup();

    render(
      <Toaster>
        <ToastTrigger />
      </Toaster>,
    );

    await user.click(screen.getByRole('button', { name: 'Notify' }));

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('All changes kept')).toBeInTheDocument();
  });

  it('removes a toast when its dismiss button is pressed', async () => {
    const user = userEvent.setup();

    render(
      <Toaster>
        <ToastTrigger />
      </Toaster>,
    );

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});
