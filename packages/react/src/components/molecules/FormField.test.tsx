import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField } from './FormField';

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
