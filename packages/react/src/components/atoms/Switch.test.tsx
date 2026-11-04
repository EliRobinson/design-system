import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Switch } from './Switch.js';

describe('Switch', () => {
  it('renders with switch semantics', () => {
    render(<Switch label="Notifications" />);

    expect(screen.getByRole('switch', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('toggles when clicked', async () => {
    const user = userEvent.setup();

    render(<Switch label="Notifications" />);

    const switchControl = screen.getByRole('switch', { name: 'Notifications' });
    await user.click(switchControl);

    expect(switchControl).toBeChecked();
  });

  it('renders the same markup as before when there is no error', () => {
    const { container } = render(<Switch label="Notifications" id="c" />);

    expect(container.innerHTML).toBe(
      '<label class="ds-switch" for="c"><input role="switch" id="c" class="ds-switch__input" type="checkbox"><span class="ds-switch__label">Notifications</span></label>',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
