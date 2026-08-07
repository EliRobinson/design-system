import { createRef } from 'react';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Combobox } from './Combobox';

const options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
];

function manyOptions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    label: `Option ${index}`,
    value: `option-${index}`,
  }));
}

describe('Combobox', () => {
  it('filters options as the user types', async () => {
    const user = userEvent.setup();
    render(<Combobox label="Fruit" options={options} onValueChange={vi.fn()} />);

    await user.click(screen.getByLabelText('Fruit'));
    await user.type(screen.getByLabelText('Fruit'), 'ba');

    // Positive fact: the matching option is actually rendered.
    expect(screen.getByRole('option', { name: 'Banana' })).toBeInTheDocument();
    // Positive fact: a non-matching option is genuinely absent, not just
    // hidden -- proves filtering narrows the rendered set rather than
    // filtering visually or not at all.
    expect(screen.queryByRole('option', { name: 'Apple' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Cherry' })).not.toBeInTheDocument();
  });

  it('calls onValueChange with the real option value when an option is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<Combobox label="Fruit" options={options} onValueChange={onValueChange} />);
    await user.click(screen.getByLabelText('Fruit'));
    await user.click(screen.getByRole('option', { name: 'Cherry' }));

    // Asserts the exact value, not just "was called" -- catches a handler
    // wired to the wrong option (e.g. always firing index 0).
    expect(onValueChange).toHaveBeenCalledWith('cherry');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows a "No matches" state and keeps the listbox id resolvable when nothing matches', async () => {
    const user = userEvent.setup();
    render(<Combobox label="Fruit" options={options} onValueChange={vi.fn()} />);

    await user.click(screen.getByLabelText('Fruit'));
    await user.type(screen.getByLabelText('Fruit'), 'zzz');

    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    // The input's aria-controls must resolve to a real element even in the
    // empty state, not a dangling id.
    const input = screen.getByLabelText('Fruit');
    const controlsId = input.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId as string)).toBeInTheDocument();
  });

  it('moves the active option with ArrowDown/ArrowUp and keeps aria-activedescendant pointed at a real, rendered element', async () => {
    const user = userEvent.setup();
    render(<Combobox label="Fruit" options={options} onValueChange={vi.fn()} />);

    const input = screen.getByLabelText('Fruit');
    await user.click(input);

    // Opening highlights the first option.
    let activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId as string)).toHaveTextContent('Apple');

    await user.keyboard('{ArrowDown}');
    activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    // The id aria-activedescendant points at must actually exist in the DOM
    // -- a dangling id here would be a silent, un-announced bug for
    // assistive tech even though the visible UI looks correct.
    expect(document.getElementById(activeId as string)).toBeInTheDocument();
    expect(document.getElementById(activeId as string)).toHaveTextContent('Banana');

    await user.keyboard('{ArrowDown}');
    activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId as string)).toHaveTextContent('Cherry');

    // Clamped at the end, not wrapped.
    await user.keyboard('{ArrowDown}');
    activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId as string)).toHaveTextContent('Cherry');

    await user.keyboard('{ArrowUp}');
    activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId as string)).toHaveTextContent('Banana');

    // DOM focus never leaves the input -- that's the entire point of
    // aria-activedescendant.
    expect(input).toHaveFocus();
  });

  it('selects the active option on Enter, not always the first one', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Combobox label="Fruit" options={options} onValueChange={onValueChange} />);

    const input = screen.getByLabelText('Fruit');
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}'); // Apple -> Banana -> Cherry
    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('cherry');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('closes on Escape without selecting', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Combobox label="Fruit" options={options} onValueChange={onValueChange} />);

    await user.click(screen.getByLabelText('Fruit'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Combobox label="Fruit" options={options} onValueChange={vi.fn()} />
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(screen.getByLabelText('Fruit'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it("forwards the ref to the underlying input element (SearchField's forwarded-ref contract)", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Combobox ref={ref} label="Fruit" options={options} onValueChange={vi.fn()} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.getAttribute('aria-label')).toBe('Fruit');
  });

  it('virtualizes a long option list: renders a windowed subset, not all options, and the active option stays resolvable', async () => {
    const user = userEvent.setup();
    const bigList = manyOptions(500);
    render(<Combobox label="Options" options={bigList} onValueChange={vi.fn()} />);

    const input = screen.getByLabelText('Options');
    await user.click(input);

    const listbox = screen.getByRole('listbox');
    const renderedOptions = within(listbox).getAllByRole('option');

    // Positive fact: some options rendered (catches a virtualizer that
    // measures a 0px viewport and silently renders zero rows).
    expect(renderedOptions.length).toBeGreaterThan(0);
    // Positive fact: far fewer than the full 500 rendered -- proves this is
    // an actually-windowed list, not the full option set with only display
    // toggling (the classic "virtualization" that renders everything).
    expect(renderedOptions.length).toBeLessThan(bigList.length);
    expect(screen.queryByRole('option', { name: 'Option 499' })).not.toBeInTheDocument();

    // Move the active option far past the initially rendered window and
    // confirm aria-activedescendant still resolves to a real, rendered
    // element -- this is the exact failure mode a naive virtualized
    // combobox has: the highlighted option scrolls out of the rendered
    // window and aria-activedescendant dangles.
    for (let i = 0; i < 30; i += 1) {
      await user.keyboard('{ArrowDown}');
    }

    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    // The scroll-into-view that brings a virtualized-out option back into
    // the rendered window is deferred by one macrotask (see Combobox.tsx),
    // so give it a tick before asserting it landed.
    await waitFor(() => {
      expect(document.getElementById(activeId as string)).toBeInTheDocument();
    });
    expect(document.getElementById(activeId as string)).toHaveTextContent('Option 30');
  });
});
