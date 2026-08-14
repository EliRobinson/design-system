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
});
