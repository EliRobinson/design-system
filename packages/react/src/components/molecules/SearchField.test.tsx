import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('renders a search input', () => {
    render(<SearchField aria-label="Search" />);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('shows a clear button only when there is a value, and clears on click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<SearchField aria-label="Search" value="hello" onValueChange={onValueChange} />);

    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    await user.click(clearButton);

    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('does not render a clear button when empty', () => {
    render(<SearchField aria-label="Search" value="" onValueChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('shows and uses the clear button in uncontrolled mode after typing', async () => {
    const user = userEvent.setup();
    render(<SearchField aria-label="Search" />);

    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');

    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    await user.click(clearButton);
    expect(input).toHaveValue('');
  });

  it('does not warn about switching from uncontrolled to controlled when the value prop appears later', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(<SearchField aria-label="Search" />);
    rerender(<SearchField aria-label="Search" value="now controlled" onValueChange={vi.fn()} />);

    const controlledWarning = consoleError.mock.calls.some((call) =>
      call.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes('A component is changing an uncontrolled input to be controlled'),
      ),
    );
    expect(controlledWarning).toBe(false);

    consoleError.mockRestore();
  });

  it('returns focus to the input after clicking clear', async () => {
    const user = userEvent.setup();
    render(<SearchField aria-label="Search" />);

    const input = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(input, 'hello');

    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    await user.click(clearButton);

    expect(document.activeElement).toBe(input);
  });
});
