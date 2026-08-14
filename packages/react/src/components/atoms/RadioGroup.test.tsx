import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RadioGroup, RadioGroupItem } from './RadioGroup.js';

describe('RadioGroup', () => {
  it('selects the item marked as the default value', () => {
    render(
      <RadioGroup name="plan" defaultValue="pro">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Free' })).not.toBeChecked();
  });

  it('calls onValueChange when a different item is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <RadioGroup name="plan" defaultValue="free" onValueChange={onValueChange}>
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    await user.click(screen.getByRole('radio', { name: 'Pro' }));

    expect(onValueChange).toHaveBeenCalledWith('pro');
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked();
  });
});
