import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './SegmentedControl.js';

const options = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

describe('SegmentedControl', () => {
  it('marks the selected option as checked', () => {
    render(<SegmentedControl options={options} value="week" onValueChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onValueChange when a different option is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<SegmentedControl options={options} value="day" onValueChange={onValueChange} />);
    await user.click(screen.getByRole('radio', { name: 'Month' }));

    expect(onValueChange).toHaveBeenCalledWith('month');
  });

  it('exposes a single tab stop via roving tabIndex', () => {
    render(<SegmentedControl options={options} value="week" onValueChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('tabIndex', '-1');
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('tabIndex', '0');
    expect(screen.getByRole('radio', { name: 'Month' })).toHaveAttribute('tabIndex', '-1');
  });

  it('moves selection and focus to the next option on ArrowRight', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<SegmentedControl options={options} value="day" onValueChange={onValueChange} />);
    screen.getByRole('radio', { name: 'Day' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onValueChange).toHaveBeenCalledWith('week');
  });

  it('wraps to the first option when ArrowRight is pressed on the last option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<SegmentedControl options={options} value="month" onValueChange={onValueChange} />);
    screen.getByRole('radio', { name: 'Month' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onValueChange).toHaveBeenCalledWith('day');
  });

  it('moves selection to the previous option on ArrowLeft', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<SegmentedControl options={options} value="week" onValueChange={onValueChange} />);
    screen.getByRole('radio', { name: 'Week' }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(onValueChange).toHaveBeenCalledWith('day');
  });

  it('jumps to the first and last option on Home and End', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<SegmentedControl options={options} value="week" onValueChange={onValueChange} />);
    screen.getByRole('radio', { name: 'Week' }).focus();
    await user.keyboard('{Home}');
    expect(onValueChange).toHaveBeenLastCalledWith('day');

    await user.keyboard('{End}');
    expect(onValueChange).toHaveBeenLastCalledWith('month');
  });

  it('forwards the ref to the outer radiogroup element', () => {
    const ref = vi.fn();
    render(<SegmentedControl ref={ref} options={options} value="day" onValueChange={vi.fn()} />);

    expect(ref).toHaveBeenCalled();
    const element = ref.mock.calls[0]?.[0] as HTMLElement;
    expect(element).toHaveAttribute('role', 'radiogroup');
  });
});
