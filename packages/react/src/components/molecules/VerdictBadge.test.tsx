import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { VerdictBadge } from './VerdictBadge.js';

describe('VerdictBadge', () => {
  it('renders the default glyph and the word together, so the verdict is never colour alone', () => {
    const { container } = render(<VerdictBadge verdict="go" label="Book it" />);

    expect(container.querySelector('.ds-verdict__glyph')).toHaveTextContent('✓');
    expect(screen.getByText('Book it')).toHaveClass('ds-verdict__word');
  });

  it('carries a default glyph for every verdict', () => {
    const cases = [
      { verdict: 'go', glyph: '✓' },
      { verdict: 'no', glyph: '✕' },
      { verdict: 'hold', glyph: '◑' },
    ] as const;

    for (const { verdict, glyph } of cases) {
      const { container, unmount } = render(<VerdictBadge verdict={verdict} label="Verdict" />);
      expect(container.querySelector('.ds-verdict__glyph')).toHaveTextContent(glyph);
      unmount();
    }
  });

  it('applies the verdict modifier class', () => {
    const { container } = render(<VerdictBadge verdict="hold" label="Wait" />);

    const badge = container.querySelector('.ds-verdict');
    expect(badge).toHaveClass('ds-verdict--hold');
    expect(badge).not.toHaveClass('ds-verdict--go');
  });

  it('lets a custom glyph override the per-verdict default', () => {
    const { container } = render(
      <VerdictBadge verdict="no" label="Skip it" glyph={<svg data-testid="mark" />} />,
    );

    expect(screen.getByTestId('mark')).toBeInTheDocument();
    expect(container.querySelector('.ds-verdict__glyph')).not.toHaveTextContent('✕');
  });

  it('hides the glyph from assistive technology, leaving the word as the accessible text', () => {
    const { container } = render(<VerdictBadge verdict="go" label="Book it" />);

    expect(container.querySelector('.ds-verdict__glyph')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.ds-verdict__word')).not.toHaveAttribute('aria-hidden');
  });

  it('forwards its ref to the outer element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<VerdictBadge ref={ref} verdict="go" label="Book it" />);

    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current).toHaveClass('ds-verdict');
  });
});
