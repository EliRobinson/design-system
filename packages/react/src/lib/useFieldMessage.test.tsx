import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from '../components/atoms/Checkbox.js';
import type { InputProps } from '../components/atoms/Input.js';
import { Input } from '../components/atoms/Input.js';
import { Switch } from '../components/atoms/Switch.js';
import { Textarea } from '../components/atoms/Textarea.js';
import { Select } from '../components/organisms/Select.js';
import { expectNoDanglingDescribedBy } from '../test/describedBy.js';
import type { FieldMessageOptions } from './useFieldMessage.js';
import { useFieldMessage } from './useFieldMessage.js';

/* The `error` contract the labelled-row controls share through
   useFieldMessage, run once per control. Each control's own test file keeps
   the snapshot of its markup without an error, which is the one case that
   differs between them. */
describe.each([
  { Control: Checkbox, role: 'checkbox', rowClass: 'ds-checkbox--error' },
  { Control: Switch, role: 'switch', rowClass: 'ds-switch--error' },
])('$Control.displayName error', ({ Control, role, rowClass }) => {
  const label = 'Accept the terms';

  it('marks the control invalid and describes it by the error', () => {
    render(<Control label={label} error="Required." />);

    const control = screen.getByRole(role, { name: label });
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAccessibleDescription('Required.');
  });

  it('renders the error as an alert with the field hint classes', () => {
    render(<Control label={label} error="Required." />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Required.');
    expect(alert).toHaveClass('ds-hint', 'ds-hint--error');
  });

  it("keeps the caller's aria-describedby alongside the error", () => {
    render(
      <>
        <p id="terms">Read the terms first.</p>
        <Control label={label} error="Required." aria-describedby="terms" />
      </>,
    );

    const control = screen.getByRole(role, { name: label });
    const ids = control.getAttribute('aria-describedby')?.split(' ');
    expect(ids?.[0]).toBe('terms');
    expect(ids).toHaveLength(2);
    expect(control).toHaveAccessibleDescription('Read the terms first. Required.');
  });

  it("passes the caller's aria-describedby through untouched without an error", () => {
    render(<Control label={label} aria-describedby="terms" />);

    expect(screen.getByRole(role)).toHaveAttribute('aria-describedby', 'terms');
    expect(screen.getByRole(role)).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('paints the invalid state on the row', () => {
    const { container } = render(<Control label={label} error="Required." />);

    expect(container.querySelector('label')).toHaveClass(rowClass);
  });

  it('forwards the ref to the input with an error', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Control ref={ref} label={label} error="Required." />);

    expect(ref.current).toBe(screen.getByRole(role));
  });

  it('keeps the same input when an error appears, so unsaved state survives', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Control label={label} />);
    const control = screen.getByRole(role);
    await user.click(control);

    rerender(<Control label={label} error="Required." />);

    expect(screen.getByRole(role)).toBe(control);
    expect(control).toBeChecked();
  });
});

/* The same contract with a hint, for the field controls that render their own
   label, hint and error through useFieldMessage. */
describe.each([
  { name: 'Input', role: 'textbox', render: (p: FieldProps) => <Input {...p} /> },
  { name: 'Textarea', role: 'textbox', render: (p: FieldProps) => <Textarea {...p} /> },
  {
    name: 'Select',
    role: 'combobox',
    render: (p: FieldProps) => (
      <Select {...p}>
        <option value="a">A</option>
      </Select>
    ),
  },
])('$name hint and error', ({ role, render: field }) => {
  const label = 'Email';
  const hint = 'We will never share it.';

  it('describes the control by the hint, without marking it invalid', () => {
    render(field({ label, hint }));

    const control = screen.getByRole(role, { name: label });
    expect(control).toHaveAccessibleDescription(hint);
    expect(control).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText(hint)).toHaveClass('ds-hint');
    expect(screen.getByText(hint)).not.toHaveClass('ds-hint--error');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expectNoDanglingDescribedBy(control);
  });

  it('renders the error as an alert that replaces the hint', () => {
    render(field({ label, hint, error: 'Required.' }));

    const control = screen.getByRole(role, { name: label });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Required.');
    expect(alert).toHaveClass('ds-hint', 'ds-hint--error');
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute('aria-describedby', alert.id);
    expectNoDanglingDescribedBy(control);
  });

  it("keeps the caller's aria-describedby first", () => {
    render(
      <>
        <p id="policy">See the policy.</p>
        {field({ label, hint, 'aria-describedby': 'policy' })}
      </>,
    );

    const control = screen.getByRole(role, { name: label });
    expect(control.getAttribute('aria-describedby')?.split(' ')[0]).toBe('policy');
    expect(control).toHaveAccessibleDescription(`See the policy. ${hint}`);
    expectNoDanglingDescribedBy(control);
  });

  it("keeps the caller's aria-describedby first with an error", () => {
    render(
      <>
        <p id="policy">See the policy.</p>
        {field({ label, hint, error: 'Required.', 'aria-describedby': 'policy' })}
      </>,
    );

    const control = screen.getByRole(role, { name: label });
    expect(control).toHaveAttribute('aria-describedby', `policy ${screen.getByRole('alert').id}`);
    expect(control).toHaveAccessibleDescription('See the policy. Required.');
  });

  it('updates the same alert in place when the error text changes', () => {
    const { rerender } = render(field({ label, error: 'Required.' }));
    const first = screen.getByRole('alert');

    rerender(field({ label, error: 'Too short.' }));

    expect(screen.getByRole('alert')).toBe(first);
    expect(first).toHaveTextContent('Too short.');
  });

  it('renders no message and no description without hint or error', () => {
    render(field({ label }));

    const control = screen.getByRole(role, { name: label });
    expect(control).not.toHaveAttribute('aria-describedby');
    expect(control).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mounts a fresh alert element when the hint turns into an error', () => {
    const { rerender } = render(field({ label, hint }));
    const control = screen.getByRole(role, { name: label });
    const hintNode = screen.getByText(hint);

    rerender(field({ label, hint, error: 'Required.' }));

    expect(screen.getByRole('alert')).not.toBe(hintNode);
    expect(hintNode).not.toBeInTheDocument();
    expect(screen.getByRole(role, { name: label })).toBe(control);
  });
});

type FieldProps = Pick<InputProps, 'label' | 'hint' | 'error' | 'aria-describedby'>;

/* The hook on its own, with one options object: each value goes by name, so
   `error` and `aria-describedby` cannot be swapped by position. */
describe('useFieldMessage', () => {
  function Probe(options: FieldMessageOptions) {
    const { controlProps, message } = useFieldMessage(options);
    return (
      <>
        <p id="own">Own description.</p>
        <input aria-label="Probe" {...controlProps} />
        {message}
      </>
    );
  }

  it('is valid and undescribed with no options set', () => {
    render(<Probe />);

    const control = screen.getByRole('textbox');
    expect(control).not.toHaveAttribute('aria-invalid');
    expect(control).not.toHaveAttribute('aria-describedby');
  });

  it('keeps ariaDescribedBy first and adds the error after it', () => {
    render(<Probe error="Required." ariaDescribedBy="own" />);

    const control = screen.getByRole('textbox');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute('aria-describedby', `own ${screen.getByRole('alert').id}`);
    expectNoDanglingDescribedBy(control);
  });

  it('does not mark the control invalid from ariaDescribedBy alone', () => {
    render(<Probe ariaDescribedBy="own" />);

    const control = screen.getByRole('textbox');
    expect(control).not.toHaveAttribute('aria-invalid');
    expect(control).toHaveAttribute('aria-describedby', 'own');
  });

  it('renders the form-field variant as paragraphs', () => {
    const { rerender } = render(<Probe hint="Hint." variant="form-field" />);
    expect(screen.getByText('Hint.')).toHaveClass(
      'ds-form-field__message',
      'ds-form-field__message--hint',
    );
    expect(screen.getByText('Hint.').tagName).toBe('P');

    rerender(<Probe hint="Hint." error="Required." variant="form-field" />);
    expect(screen.getByRole('alert')).toHaveClass(
      'ds-form-field__message',
      'ds-form-field__message--error',
    );
    expectNoDanglingDescribedBy(screen.getByRole('textbox'));
  });
});
