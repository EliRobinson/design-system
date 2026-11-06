import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button, type ButtonVariant } from './Button.js';

describe('Button variant="destructive"', () => {
  it('renders the destructive class', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'ds-button',
      'ds-button--destructive',
    );
  });

  it('is part of ButtonVariant', () => {
    const variant: ButtonVariant = 'destructive';
    expect(variant).toBe('destructive');
  });

  it.each(['sm', 'md', 'lg'] as const)('works with size %s', (size) => {
    render(
      <Button variant="destructive" size={size}>
        Delete
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveClass('ds-button--destructive', `ds-button--${size}`);
  });

  it('keeps the disabled state and does not fire', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button variant="destructive" disabled onClick={onClick}>
        Delete
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('ds-button--destructive', 'ds-button--disabled');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can take focus by keyboard and by ref', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button variant="destructive" ref={ref}>
        Delete
      </Button>,
    );
    await user.tab();
    expect(ref.current).toHaveFocus();
  });

  it('fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button variant="destructive" onClick={onClick}>
        Delete
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
