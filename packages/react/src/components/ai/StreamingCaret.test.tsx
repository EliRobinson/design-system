import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { StreamingCaret } from './StreamingCaret.js';

describe('StreamingCaret', () => {
  it('renders a caret by default', () => {
    const { container } = render(<StreamingCaret />);
    expect(container.querySelector('.ds-streaming-caret')).not.toBeNull();
  });

  it('renders nothing at all when active is false', () => {
    const { container } = render(<StreamingCaret active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('is a status region when it carries a label', () => {
    render(<StreamingCaret label="Still writing" />);
    expect(screen.getByRole('status', { name: 'Still writing' })).toBeInTheDocument();
  });

  it('is hidden from assistive technology without a label', () => {
    const { container } = render(<StreamingCaret />);

    const caret = container.querySelector('.ds-streaming-caret');
    expect(caret).toHaveAttribute('aria-hidden', 'true');
    expect(caret).not.toHaveAttribute('role');
  });

  it('forwards its ref to the caret element', () => {
    const ref = createRef<HTMLSpanElement>();

    const { container } = render(<StreamingCaret ref={ref} />);

    expect(ref.current).toBe(container.querySelector('.ds-streaming-caret'));
  });
});
