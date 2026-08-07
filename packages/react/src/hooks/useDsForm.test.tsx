import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useDsForm } from './useDsForm';

function TestForm({ onSubmit }: { onSubmit: (value: string) => void }) {
  const form = useDsForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => onSubmit(value.email),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <input
            aria-label="Email"
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
      <button type="submit">Submit</button>
    </form>
  );
}

describe('useDsForm', () => {
  it('submits the current field value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TestForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith('a@b.com');
  });

  it('does not call the submit handler before submission', () => {
    const onSubmit = vi.fn();

    render(<TestForm onSubmit={onSubmit} />);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
