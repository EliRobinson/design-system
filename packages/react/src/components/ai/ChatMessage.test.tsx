import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { ChatMessage } from './ChatMessage.js';

describe('ChatMessage', () => {
  it('renders the avatar node and its children', () => {
    render(<ChatMessage avatar={<span data-testid="mark">A</span>}>Hello there</ChatMessage>);

    expect(screen.getByTestId('mark')).toBeInTheDocument();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('is a received turn by default', () => {
    const { container } = render(<ChatMessage avatar="A">Hello there</ChatMessage>);
    expect(container.querySelector('.ds-chat-message')).toHaveClass('ds-chat-message--received');
  });

  it('is a sent turn when asked for one', () => {
    const { container } = render(
      <ChatMessage avatar="A" variant="sent">
        Hello there
      </ChatMessage>,
    );

    const message = container.querySelector('.ds-chat-message');
    expect(message).toHaveClass('ds-chat-message--sent');
    expect(message).not.toHaveClass('ds-chat-message--received');
  });

  it('renders the name and timestamp when given', () => {
    render(
      <ChatMessage avatar="A" name="Assistant" timestamp="09:41">
        Hello there
      </ChatMessage>,
    );

    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('09:41')).toBeInTheDocument();
  });

  it('renders the actions node in an actions slot', () => {
    const { container } = render(
      <ChatMessage avatar="A" actions={<button type="button">Retry</button>}>
        Hello there
      </ChatMessage>,
    );

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(container.querySelector('.ds-chat-message__actions')).not.toBeNull();
  });

  it('renders no actions element when actions is omitted', () => {
    const { container } = render(<ChatMessage avatar="A">Hello there</ChatMessage>);
    expect(container.querySelector('.ds-chat-message__actions')).toBeNull();
  });

  it('forwards its ref to the message element', () => {
    const ref = createRef<HTMLDivElement>();

    const { container } = render(
      <ChatMessage avatar="A" ref={ref}>
        Hello there
      </ChatMessage>,
    );

    expect(ref.current).toBe(container.querySelector('.ds-chat-message'));
  });
});
