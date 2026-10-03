import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from '../components/atoms/Checkbox.js';
import { Switch } from '../components/atoms/Switch.js';

/* The `error` contract the labelled-row controls share through
   useControlError, run once per control. Each control's own test file keeps
   the snapshot of its markup without an error, which is the one case that
   differs between them. */
describe.each([
  { Control: Checkbox, role: 'checkbox', rowClass: 'ds-checkbox--error' },
  { Control: Switch, role: 'switch', rowClass: 'ds-switch--error' },
])('$Control.displayName error', ({ Control, role, rowClass }) => {
  const label = 'Accept the terms';

  it('marks the control invalid and describes it by the error', () => {
    render(<Control label={label} error="Required." />);

    const control = screen.getByRole(role, { name: label });
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAccessibleDescription('Required.');
  });

  it('renders the error as an alert with the field hint classes', () => {
    render(<Control label={label} error="Required." />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Required.');
    expect(alert).toHaveClass('ds-hint', 'ds-hint--error');
  });

  it("keeps the caller's aria-describedby alongside the error", () => {
    render(
      <>
        <p id="terms">Read the terms first.</p>
        <Control label={label} error="Required." aria-describedby="terms" />
      </>,
    );

    const control = screen.getByRole(role, { name: label });
    const ids = control.getAttribute('aria-describedby')?.split(' ');
    expect(ids?.[0]).toBe('terms');
    expect(ids).toHaveLength(2);
    expect(control).toHaveAccessibleDescription('Read the terms first. Required.');
  });

  it("passes the caller's aria-describedby through untouched without an error", () => {
    render(<Control label={label} aria-describedby="terms" />);

    expect(screen.getByRole(role)).toHaveAttribute('aria-describedby', 'terms');
    expect(screen.getByRole(role)).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('paints the invalid state on the row', () => {
    const { container } = render(<Control label={label} error="Required." />);

    expect(container.querySelector('label')).toHaveClass(rowClass);
  });

  it('forwards the ref to the input with an error', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Control ref={ref} label={label} error="Required." />);

    expect(ref.current).toBe(screen.getByRole(role));
  });

  it('keeps the same input when an error appears, so unsaved state survives', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Control label={label} />);
    const control = screen.getByRole(role);
    await user.click(control);

    rerender(<Control label={label} error="Required." />);

    expect(screen.getByRole(role)).toBe(control);
    expect(control).toBeChecked();
  });
});
