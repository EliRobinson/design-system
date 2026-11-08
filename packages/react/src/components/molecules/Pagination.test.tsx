import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  const pageLabels = () =>
    screen.getAllByRole('button', { name: /^Page \d+$/ }).map((button) => button.textContent);

  it('shows every page up to seven', () => {
    render(<Pagination page={4} pageCount={7} onPageChange={vi.fn()} />);
    expect(pageLabels()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('keeps the first five pages and the last near the start of a long range', () => {
    render(<Pagination page={2} pageCount={20} onPageChange={vi.fn()} />);
    expect(pageLabels()).toEqual(['1', '2', '3', '4', '5', '20']);
  });

  it('keeps the current page and its neighbours in the middle of a long range', () => {
    render(<Pagination page={10} pageCount={20} onPageChange={vi.fn()} />);
    expect(pageLabels()).toEqual(['1', '9', '10', '11', '20']);
    expect(screen.getByRole('button', { name: 'Page 10' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the first page and the last five near the end of a long range', () => {
    render(<Pagination page={19} pageCount={20} onPageChange={vi.fn()} />);
    expect(pageLabels()).toEqual(['1', '16', '17', '18', '19', '20']);
  });

  it('keeps an out-of-range page inside the window', () => {
    render(<Pagination page={50} pageCount={20} onPageChange={vi.fn()} />);
    expect(pageLabels()).toEqual(['1', '16', '17', '18', '19', '20']);
    expect(screen.getByText('Page 20 of 20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 20' })).toHaveAttribute('aria-current', 'page');
  });

  describe('when the row of numbers does not fit', () => {
    // jsdom has no layout. Every button is one 44px target, and the nav is
    // `navWidth` wide. Six pages need (6 + 2) x 44 = 352px with no gaps.
    let navWidth = 0;
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(44);
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => navWidth);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows "Page X of Y" in place of the numbers', () => {
      navWidth = 300;
      render(<Pagination page={3} pageCount={6} onPageChange={vi.fn()} />);
      expect(screen.getByRole('navigation')).toHaveClass('ds-pagination--compact');
      expect(screen.getByText('Page 3 of 6')).toHaveClass('ds-pagination__summary');
    });

    it('keeps the numbers when they fit', () => {
      navWidth = 352;
      render(<Pagination page={3} pageCount={6} onPageChange={vi.fn()} />);
      expect(screen.getByRole('navigation')).not.toHaveClass('ds-pagination--compact');
    });
  });

  it('forwards its ref to the nav', () => {
    const ref = createRef<HTMLElement>();
    render(<Pagination ref={ref} page={1} pageCount={3} onPageChange={vi.fn()} />);
    expect(ref.current).toBe(screen.getByRole('navigation'));
  });
});
