import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Rating } from './Rating';

describe('Rating', () => {
  it('renders as a static value with no buttons when onValueChange is omitted', () => {
    render(<Rating value={3} />);
    expect(screen.getByRole('img', { name: '3 out of 5 stars' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders interactive star buttons and calls onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<Rating value={2} onValueChange={onValueChange} />);
    await user.click(screen.getByRole('button', { name: 'Rate 4 out of 5 stars' }));

    expect(onValueChange).toHaveBeenCalledWith(4);
  });

  it('forwards the ref to the outer element in read-only mode', () => {
    const ref = vi.fn();
    render(<Rating ref={ref} value={3} />);

    expect(ref).toHaveBeenCalled();
    const element = ref.mock.calls[0]?.[0] as HTMLElement;
    expect(element).toHaveAttribute('role', 'img');
  });

  it('forwards the ref to the outer element in interactive mode', () => {
    const ref = vi.fn();
    render(<Rating ref={ref} value={3} onValueChange={vi.fn()} />);

    expect(ref).toHaveBeenCalled();
    const element = ref.mock.calls[0]?.[0] as HTMLElement;
    expect(element).toHaveClass('ds-rating');
  });
});
