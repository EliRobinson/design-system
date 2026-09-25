import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField } from './FormField.js';

describe('FormField', () => {
  it('associates the label with the child input via htmlFor/id', () => {
    render(
      <FormField label="Email" htmlFor="email">
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders error text and wires it to aria-describedby and aria-invalid', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Required">
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    const input = screen.getByLabelText('Email');
    const message = screen.getByText('Required');
    expect(input).toHaveAttribute('aria-describedby', message.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders hint text when there is no error', () => {
    render(
      <FormField label="Email" htmlFor="email" hint="We'll never share this">
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    expect(screen.getByText("We'll never share this")).toBeInTheDocument();
  });

  it('sets aria-required on the child input when required is true', () => {
    render(
      <FormField label="Email" htmlFor="email" required>
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Email', { exact: false })).toHaveAttribute(
      'aria-required',
      'true',
    );
  });

  it('omits aria-required on the child input when required is not set', () => {
    render(
      <FormField label="Email" htmlFor="email">
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-required');
  });
});

describe('FormField error announcement', () => {
  it('renders the error with role="alert", as Input does, and keeps it describing the control', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Enter a valid email">
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a valid email');
    expect(alert).toHaveClass('ds-form-field__message', 'ds-form-field__message--error');

    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(input).toHaveAccessibleDescription('Enter a valid email');
  });

  it('does not give a hint role="alert"', () => {
    render(
      <FormField label="Email" htmlFor="email" hint="We'll never share this">
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      "We'll never share this",
    );
  });

  it('renders no alert when there is no error', () => {
    render(
      <FormField label="Email" htmlFor="email">
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  /*
   * The validate-on-blur case the role exists for. A live region that is inserted with its
   * text is announced; one whose role is added to an element already in the tree, in the same
   * commit as its text, is not reliably announced. So the hint's `<p>` must not be reused.
   */
  it('mounts a fresh alert element when a hint turns into an error', () => {
    const field = (error?: string) => (
      <FormField label="Email" htmlFor="email" hint="We'll never share this" error={error}>
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>
    );
    const { rerender } = render(field());
    const hint = screen.getByText("We'll never share this");

    rerender(field('Enter a valid email'));

    const alert = screen.getByRole('alert');
    expect(alert).not.toBe(hint);
    expect(hint).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      'Enter a valid email',
    );
  });

  it('updates the same alert in place when the error text changes', () => {
    const field = (error: string) => (
      <FormField label="Email" htmlFor="email" error={error}>
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>
    );
    const { rerender } = render(field('Required'));
    const first = screen.getByRole('alert');

    rerender(field('Enter a valid email'));

    expect(screen.getByRole('alert')).toBe(first);
    expect(first).toHaveTextContent('Enter a valid email');
  });
});

describe('FormField labelAside', () => {
  it('renders the aside on the label row without changing the accessible name', () => {
    const { container } = render(
      <FormField
        label="History"
        htmlFor="history"
        required
        hint="From the last visit"
        labelAside={<span className="ds-badge">Pre-populated</span>}
      >
        {(fieldProps) => <textarea id="history" {...fieldProps} />}
      </FormField>,
    );

    const row = container.querySelector('.ds-form-field__label-row');
    expect(row).not.toBeNull();
    expect(row?.children[0]?.tagName).toBe('LABEL');
    expect(row).toHaveTextContent('Pre-populated');

    // The aside is a sibling of the label, never inside it.
    expect(container.querySelector('label')).not.toHaveTextContent('Pre-populated');
    // The aria-hidden asterisk is not part of the name, with or without an aside.
    const textarea = screen.getByRole('textbox', { name: 'History' });
    expect(textarea).toHaveAttribute('id', 'history');
    expect(textarea).toHaveAccessibleDescription('From the last visit');
  });

  it('keeps an action button in the aside out of the label and its own name', () => {
    render(
      <FormField
        label="Assessment"
        htmlFor="assessment"
        labelAside={
          <button type="button" aria-pressed="false">
            Dictate
          </button>
        }
      >
        {(fieldProps) => <textarea id="assessment" {...fieldProps} />}
      </FormField>,
    );

    expect(screen.getByRole('textbox')).toHaveAccessibleName('Assessment');
    expect(screen.getByRole('button')).toHaveAccessibleName('Dictate');
    expect(screen.getByRole('button').closest('label')).toBeNull();
  });

  it.each([undefined, null, false])('renders no label row for labelAside=%s', (labelAside) => {
    const { container } = render(
      <FormField label="Email" htmlFor="email" labelAside={labelAside}>
        {(fieldProps) => <input id="email" {...fieldProps} />}
      </FormField>,
    );

    expect(container.querySelector('.ds-form-field__label-row')).toBeNull();
    expect(container.querySelector('.ds-form-field > label')).toHaveAttribute('for', 'email');
  });
});
