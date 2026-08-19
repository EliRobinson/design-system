import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { ChatThread } from './ChatThread.js';

describe('ChatThread', () => {
  it('is a log region named by its label', () => {
    render(<ChatThread label="Conversation" />);
    expect(screen.getByRole('log', { name: 'Conversation' })).toBeInTheDocument();
  });

  it('announces additions and edits politely by default', () => {
    render(<ChatThread label="Conversation" />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-relevant', 'additions text');
  });

  it('opts out of live announcement when announce is false', () => {
    render(<ChatThread label="Conversation" announce={false} />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'off');
  });

  it('renders its children', () => {
    render(<ChatThread label="Conversation">turn</ChatThread>);
    expect(screen.getByText('turn')).toBeInTheDocument();
  });

  it('forwards its ref to the log element', () => {
    const ref = createRef<HTMLDivElement>();

    render(<ChatThread label="Conversation" ref={ref} />);

    expect(ref.current).toBe(screen.getByRole('log'));
  });
});
