import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
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
  describe('error', () => {
    it('marks the control invalid and describes it by the error', () => {
      render(<Checkbox label="Email updates" error="Required." />);

      const control = screen.getByRole('checkbox', { name: 'Email updates' });
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveAccessibleDescription('Required.');
    });

    it('renders the error as an alert with the field hint classes', () => {
      render(<Checkbox label="Email updates" error="Required." />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Required.');
      expect(alert).toHaveClass('ds-hint', 'ds-hint--error');
    });

    it("keeps the caller's aria-describedby alongside the error", () => {
      render(
        <>
          <p id="terms">Read the terms first.</p>
          <Checkbox label="Email updates" error="Required." aria-describedby="terms" />
        </>,
      );

      const control = screen.getByRole('checkbox', { name: 'Email updates' });
      const ids = control.getAttribute('aria-describedby')?.split(' ');
      expect(ids?.[0]).toBe('terms');
      expect(ids).toHaveLength(2);
      expect(control).toHaveAccessibleDescription('Read the terms first. Required.');
    });

    it("passes the caller's aria-describedby through untouched without an error", () => {
      render(<Checkbox label="Email updates" aria-describedby="terms" />);

      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-describedby', 'terms');
    });

    it('paints the invalid state on the row', () => {
      const { container } = render(<Checkbox label="Email updates" error="Required." />);

      expect(container.querySelector('label')).toHaveClass('ds-checkbox--error');
    });

    it('forwards the ref to the input with an error', () => {
      const ref = createRef<HTMLInputElement>();
      render(<Checkbox ref={ref} label="Email updates" error="Required." />);

      expect(ref.current).toBe(screen.getByRole('checkbox'));
    });

    it('renders the same markup as before when there is no error', () => {
      const { container } = render(<Checkbox label="Email updates" id="c" />);

      expect(container.innerHTML).toBe(
        '<label class="ds-checkbox" for="c"><input id="c" class="ds-checkbox__input" type="checkbox"><span class="ds-checkbox__label">Email updates</span></label>',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the same input when an error appears, so unsaved state survives', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Checkbox label="Email updates" />);
      const control = screen.getByRole('checkbox');
      await user.click(control);

      rerender(<Checkbox label="Email updates" error="Required." />);

      expect(screen.getByRole('checkbox')).toBe(control);
      expect(control).toBeChecked();
    });
  });
});
