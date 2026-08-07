import { createRef } from 'react';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('opens the calendar when the input is clicked', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={vi.fn()} />);

    await user.click(screen.getByLabelText('Start date'));

    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('calls onValueChange with the clicked day and closes the calendar', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByLabelText('Start date'));
    await user.click(screen.getByRole('button', { name: '20' }));

    expect(onValueChange).toHaveBeenCalledWith(new Date(2026, 0, 20));
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('closes the calendar when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={vi.fn()} />
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(screen.getByLabelText('Start date'));
    expect(screen.getByRole('grid')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('renders a valid grid: every row has exactly 7 gridcells', async () => {
    // Guards against the brief's original defect, where bare <span>/<button>
    // elements sat directly inside role="grid" with no role="row" wrapper --
    // `getByRole('grid')` alone can't catch that, so this asserts the actual
    // row > gridcell nesting the ARIA grid pattern requires.
    const user = userEvent.setup();
    render(<DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={vi.fn()} />);
    await user.click(screen.getByLabelText('Start date'));

    const grid = screen.getByRole('grid');
    const rows = within(grid).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(within(row).getAllByRole('gridcell')).toHaveLength(7);
    }
  });

  it('renders the correct number of day cells for a 31-day month with a leading offset', async () => {
    // January 2026: independently derive the expected leading-blank count
    // and day count from the native Date object (a trusted oracle distinct
    // from the component's own week-building loop), so a bug in that loop
    // -- e.g. an off-by-one in the leading offset or a dropped trailing
    // week -- would be caught by mismatched rendered counts.
    const user = userEvent.setup();
    render(<DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={vi.fn()} />);
    await user.click(screen.getByLabelText('Start date'));

    const leadingBlanks = new Date(2026, 0, 1).getDay();
    const totalDays = new Date(2026, 1, 0).getDate();

    const grid = screen.getByRole('grid');
    const gridcells = within(grid).getAllByRole('gridcell');
    const dayButtons = gridcells.filter((cell) => cell.querySelector('button'));
    const emptyCells = gridcells.filter((cell) => cell.getAttribute('aria-disabled') === 'true');

    expect(totalDays).toBe(31);
    expect(dayButtons).toHaveLength(totalDays);
    expect(emptyCells).toHaveLength(leadingBlanks);
    expect(gridcells.length % 7).toBe(0);
  });

  it('renders 29 day cells for February 2024 (leap year)', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Start date" value={new Date(2024, 1, 10)} onValueChange={vi.fn()} />);
    await user.click(screen.getByLabelText('Start date'));

    const grid = screen.getByRole('grid');
    const dayButtons = within(grid)
      .getAllByRole('gridcell')
      .filter((cell) => cell.querySelector('button'));

    expect(dayButtons).toHaveLength(29);
  });

  it('renders 28 day cells for February 2025 (non-leap year)', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Start date" value={new Date(2025, 1, 10)} onValueChange={vi.fn()} />);
    await user.click(screen.getByLabelText('Start date'));

    const grid = screen.getByRole('grid');
    const dayButtons = within(grid)
      .getAllByRole('gridcell')
      .filter((cell) => cell.querySelector('button'));

    expect(dayButtons).toHaveLength(28);
  });

  it('navigates from December to January across a year boundary', async () => {
    const user = userEvent.setup();
    render(
      <DatePicker label="Start date" value={new Date(2025, 11, 15)} onValueChange={vi.fn()} />,
    );
    await user.click(screen.getByLabelText('Start date'));

    expect(screen.getByText('December 2025')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByText('January 2026')).toBeInTheDocument();
    const grid = screen.getByRole('grid');
    const dayButtons = within(grid)
      .getAllByRole('gridcell')
      .filter((cell) => cell.querySelector('button'));
    expect(dayButtons).toHaveLength(31);
  });

  it('navigates from January back to December across a year boundary', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={vi.fn()} />);
    await user.click(screen.getByLabelText('Start date'));

    expect(screen.getByText('January 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByText('December 2025')).toBeInTheDocument();
  });

  it('forwards the ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<DatePicker ref={ref} label="Start date" onValueChange={vi.fn()} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.getAttribute('aria-label')).toBe('Start date');
  });

  it('re-syncs the displayed month when a controlled `value` changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={vi.fn()} />,
    );

    rerender(
      <DatePicker label="Start date" value={new Date(2027, 5, 10)} onValueChange={vi.fn()} />,
    );

    await user.click(screen.getByLabelText('Start date'));

    expect(screen.getByRole('grid')).toHaveAccessibleName('June 2027');
  });

  it('does not yank the displayed month back if the user navigated and `value` has not changed', async () => {
    const user = userEvent.setup();
    const value = new Date(2026, 0, 15);
    const { rerender } = render(
      <DatePicker label="Start date" value={value} onValueChange={vi.fn()} />,
    );

    await user.click(screen.getByLabelText('Start date'));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('February 2026')).toBeInTheDocument();

    // Re-render with the SAME value (new Date instance, same time) -- this
    // must not reset the calendar back to January.
    rerender(<DatePicker label="Start date" value={value} onValueChange={vi.fn()} />);

    expect(screen.getByText('February 2026')).toBeInTheDocument();
  });

  it('marks the selected day with aria-selected and a selection class, and no other day', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={vi.fn()} />);

    await user.click(screen.getByLabelText('Start date'));

    const selectedButton = screen.getByRole('button', { name: '15' });
    const selectedCell = selectedButton.closest('[role="gridcell"]');
    expect(selectedCell).toHaveAttribute('aria-selected', 'true');
    expect(selectedButton.className).toMatch(/--selected/);

    const otherButton = screen.getByRole('button', { name: '20' });
    const otherCell = otherButton.closest('[role="gridcell"]');
    expect(otherCell).toHaveAttribute('aria-selected', 'false');
    expect(otherButton.className).not.toMatch(/--selected/);
  });
});
