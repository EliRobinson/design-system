import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('starts with nothing selected when uncontrolled with no defaultValue', () => {
    render(
      <RadioGroup name="plan">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Free' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pro' })).not.toBeChecked();
  });

  /* The prop table promises the group's `name` is the submitted field name.
     That is only true because RadioGroupItem renders a real radio input, which
     is an implementation detail a refactor could quietly drop -- so the promise
     is pinned here rather than left to the docs. */
  it('submits the selection under the group name, with no hidden input', () => {
    render(
      <form aria-label="settings">
        <RadioGroup name="plan" defaultValue="pro">
          <RadioGroupItem value="free" label="Free" />
          <RadioGroupItem value="pro" label="Pro" />
        </RadioGroup>
      </form>,
    );

    const data = new FormData(screen.getByRole('form', { name: 'settings' }) as HTMLFormElement);

    expect(data.get('plan')).toBe('pro');
    expect([...data.keys()]).toEqual(['plan']);
  });
});

/* None of this was covered before, which is how #169 survived: both original
   cases pass `defaultValue` and neither passes `value`, so the controlled path
   had no tests at all. */
describe('RadioGroup controlled mode', () => {
  function ControlledGroup({ initial = null }: { initial?: string | null }) {
    const [value, setValue] = useState<string | null>(initial);
    return (
      <>
        <RadioGroup name="plan" value={value} onValueChange={setValue}>
          <RadioGroupItem value="free" label="Free" />
          <RadioGroupItem value="pro" label="Pro" />
        </RadioGroup>
        <button type="button" onClick={() => setValue(null)}>
          Clear
        </button>
        <output>selected: {value ?? '(none)'}</output>
      </>
    );
  }

  it('renders nothing selected when controlled with a null value', () => {
    render(<ControlledGroup />);

    expect(screen.getByRole('radio', { name: 'Free' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pro' })).not.toBeChecked();
  });

  /* The reproduction from #169, with the one change the fix requires of it:
     the parent clears with `null` rather than `undefined`. Clearing with
     `undefined` still hands the group back to its own state -- see the
     controlled-to-uncontrolled case below. */
  it('can be cleared by setting value back to null', async () => {
    const user = userEvent.setup();
    render(<ControlledGroup />);

    await user.click(screen.getByRole('radio', { name: 'Pro' }));
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText(/selected: \(none\)/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Pro' })).not.toBeChecked();
  });

  /* The half of the bug that outlived the first click: because the old code
     wrote internal state whenever `value` was undefined, a group that started
     controlled-and-empty ended up with two sources of truth, and the stale
     internal one won. Starting empty is therefore the case that matters. */
  it('keeps the parent as the only source of truth across repeated clicks', async () => {
    const user = userEvent.setup();
    render(<ControlledGroup />);

    await user.click(screen.getByRole('radio', { name: 'Pro' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('radio', { name: 'Free' }));

    expect(screen.getByRole('radio', { name: 'Free' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pro' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByRole('radio', { name: 'Free' })).not.toBeChecked();
  });

  it('lets a parent that refuses the change win over the click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <RadioGroup name="plan" value="free" onValueChange={onValueChange}>
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    await user.click(screen.getByRole('radio', { name: 'Pro' }));

    expect(onValueChange).toHaveBeenCalledWith('pro');
    expect(screen.getByRole('radio', { name: 'Free' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pro' })).not.toBeChecked();
  });

  it('follows a value the parent changes on its own, with no user interaction', () => {
    const { rerender } = render(
      <RadioGroup name="plan" value="free">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Free' })).toBeChecked();

    rerender(
      <RadioGroup name="plan" value="pro">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Free' })).not.toBeChecked();
  });

  /* The stale-internal-state half of #169, and the case that survives longest
     in a real app: a group left uncontrolled long enough for a click to land
     in its internal state, then handed a controlled `null`. `value ?? internal`
     resolved that null straight back to the click the parent was trying to
     discard. */
  it('clears a selection left behind by an earlier uncontrolled click', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <RadioGroup name="plan">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    await user.click(screen.getByRole('radio', { name: 'Pro' }));
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked();

    rerender(
      <RadioGroup name="plan" value={null}>
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Pro' })).not.toBeChecked();
  });

  it('ignores defaultValue when a value is passed', () => {
    render(
      <RadioGroup name="plan" value={null} defaultValue="pro">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Pro' })).not.toBeChecked();
  });
});

describe('RadioGroup controlled/uncontrolled boundary', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  afterEach(() => {
    warn.mockClear();
  });

  /* `undefined` means uncontrolled, so this is not a bug -- it is the
     convention, and it is the one thing the type cannot enforce, since a
     consumer holding `useState<string | undefined>` gets no error for it. */
  it('treats an undefined value as uncontrolled and warns about the flip', () => {
    const { rerender } = render(
      <RadioGroup name="plan" value="pro">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    rerender(
      <RadioGroup name="plan" value={undefined}>
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('controlled to uncontrolled'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('pass `null`'));
  });

  it('says nothing when a group stays uncontrolled', async () => {
    const user = userEvent.setup();

    render(
      <RadioGroup name="plan" defaultValue="free">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    await user.click(screen.getByRole('radio', { name: 'Pro' }));

    expect(warn).not.toHaveBeenCalled();
  });

  it('says nothing when a controlled group is cleared with null', async () => {
    const user = userEvent.setup();

    function Group() {
      const [value, setValue] = useState<string | null>('pro');
      return (
        <>
          <RadioGroup name="plan" value={value} onValueChange={setValue}>
            <RadioGroupItem value="free" label="Free" />
            <RadioGroupItem value="pro" label="Pro" />
          </RadioGroup>
          <button type="button" onClick={() => setValue(null)}>
            Clear
          </button>
        </>
      );
    }

    render(<Group />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByRole('radio', { name: 'Pro' })).not.toBeChecked();
    expect(warn).not.toHaveBeenCalled();
  });
});
