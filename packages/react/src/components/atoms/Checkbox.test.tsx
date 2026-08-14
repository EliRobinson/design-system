import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './Checkbox.js';

describe('Checkbox', () => {
  it('renders with an associated label', () => {
    render(<Checkbox label="Email updates" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Email updates' });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('toggles when clicked', async () => {
    const user = userEvent.setup();

    render(<Checkbox label="Email updates" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Email updates' });
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
  });
});
