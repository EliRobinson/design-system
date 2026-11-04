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

  it('renders the same markup as before when there is no error', () => {
    const { container } = render(<Checkbox label="Email updates" id="c" />);

    expect(container.innerHTML).toBe(
      '<label class="ds-checkbox" for="c"><input id="c" class="ds-checkbox__input" type="checkbox"><span class="ds-checkbox__label">Email updates</span></label>',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
