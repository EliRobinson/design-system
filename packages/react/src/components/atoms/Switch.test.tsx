import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
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
  describe('error', () => {
    it('marks the control invalid and describes it by the error', () => {
      render(<Switch label="Notifications" error="Required." />);

      const control = screen.getByRole('switch', { name: 'Notifications' });
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveAccessibleDescription('Required.');
    });

    it('renders the error as an alert with the field hint classes', () => {
      render(<Switch label="Notifications" error="Required." />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Required.');
      expect(alert).toHaveClass('ds-hint', 'ds-hint--error');
    });

    it("keeps the caller's aria-describedby alongside the error", () => {
      render(
        <>
          <p id="terms">Read the terms first.</p>
          <Switch label="Notifications" error="Required." aria-describedby="terms" />
        </>,
      );

      const control = screen.getByRole('switch', { name: 'Notifications' });
      const ids = control.getAttribute('aria-describedby')?.split(' ');
      expect(ids?.[0]).toBe('terms');
      expect(ids).toHaveLength(2);
      expect(control).toHaveAccessibleDescription('Read the terms first. Required.');
    });

    it("passes the caller's aria-describedby through untouched without an error", () => {
      render(<Switch label="Notifications" aria-describedby="terms" />);

      expect(screen.getByRole('switch')).toHaveAttribute('aria-describedby', 'terms');
    });

    it('paints the invalid state on the row', () => {
      const { container } = render(<Switch label="Notifications" error="Required." />);

      expect(container.querySelector('label')).toHaveClass('ds-switch--error');
    });

    it('forwards the ref to the input with an error', () => {
      const ref = createRef<HTMLInputElement>();
      render(<Switch ref={ref} label="Notifications" error="Required." />);

      expect(ref.current).toBe(screen.getByRole('switch'));
    });

    it('renders the same markup as before when there is no error', () => {
      const { container } = render(<Switch label="Notifications" id="c" />);

      expect(container.innerHTML).toBe(
        '<label class="ds-switch" for="c"><input role="switch" id="c" class="ds-switch__input" type="checkbox"><span class="ds-switch__label">Notifications</span></label>',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the same input when an error appears, so unsaved state survives', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Switch label="Notifications" />);
      const control = screen.getByRole('switch');
      await user.click(control);

      rerender(<Switch label="Notifications" error="Required." />);

      expect(screen.getByRole('switch')).toBe(control);
      expect(control).toBeChecked();
    });
  });
});
