import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { expectNoDanglingDescribedBy } from '../../test/describedBy.js';
import { Checkbox } from './Checkbox.js';
import { FieldError } from './FieldError.js';
import { Input } from './Input.js';

/* The control's error with its generated id taken off, so two renders compare. */
function withoutId(node: HTMLElement) {
  const copy = node.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  return copy.outerHTML;
}

describe('FieldError', () => {
  it('renders the same element as a control’s error', () => {
    const input = render(<Input label="Email" error="Required." />);
    const fromInput = withoutId(screen.getByRole('alert'));
    input.unmount();
    const checkbox = render(<Checkbox label="Accept" error="Required." />);
    const fromCheckbox = withoutId(screen.getByRole('alert'));
    checkbox.unmount();

    render(<FieldError>Required.</FieldError>);

    const standalone = screen.getByRole('alert');
    expect(standalone.outerHTML).toBe(fromInput);
    expect(standalone.outerHTML).toBe(fromCheckbox);
  });

  it('is an alert with the field hint classes', () => {
    render(<FieldError>Make at least 1 Manager an Admin.</FieldError>);

    const alert = screen.getByRole('alert');
    expect(alert.tagName).toBe('SPAN');
    expect(alert).toHaveClass('ds-hint', 'ds-hint--error');
    expect(alert).toHaveTextContent('Make at least 1 Manager an Admin.');
  });

  it('takes an id, so a group can be described by it', () => {
    render(
      <>
        <fieldset aria-describedby="managers-error">
          <legend>Managers</legend>
        </fieldset>
        <FieldError id="managers-error">Make at least 1 Manager an Admin.</FieldError>
      </>,
    );

    const group = screen.getByRole('group', { name: 'Managers' });
    expect(group).toHaveAccessibleDescription('Make at least 1 Manager an Admin.');
    expectNoDanglingDescribedBy(group);
  });

  it('renders nothing without a message, so no empty alert is left behind', () => {
    const { container } = render(<FieldError id="x">{undefined}</FieldError>);

    expect(container).toBeEmptyDOMElement();
  });

  it('adds a className to its own and keeps role="alert"', () => {
    render(
      // @ts-expect-error role is not a prop: the element is always an alert.
      <FieldError className="extra" role="status">
        Required.
      </FieldError>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('ds-hint', 'ds-hint--error', 'extra');
  });

  it('forwards the ref to the element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<FieldError ref={ref}>Required.</FieldError>);

    expect(ref.current).toBe(screen.getByRole('alert'));
  });
});
