import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from './Chip';

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip>Design</Chip>);
    expect(screen.getByText('Design')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(<Chip onRemove={onRemove}>Design</Chip>);
    await user.click(screen.getByRole('button', { name: 'Remove Design' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not render a remove button when onRemove is omitted', () => {
    render(<Chip>Design</Chip>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
