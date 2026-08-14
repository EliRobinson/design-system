import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination.js';

describe('Pagination', () => {
  it('disables Previous on the first page and Next on the last page', () => {
    render(<Pagination page={1} pageCount={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
  });

  it('calls onPageChange with the next page number', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when a page number is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('clamps Previous to the last valid page when page is out of range', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination page={5} pageCount={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables both nav buttons and renders no page buttons when pageCount is 0', () => {
    render(<Pagination page={1} pageCount={0} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Page \d+$/ })).not.toBeInTheDocument();
  });
});
