import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { DecisionCard } from './DecisionCard.js';

const base = {
  verdict: 'go',
  verdictLabel: 'Book it',
  headline: 'This one is worth taking.',
} as const;

describe('DecisionCard', () => {
  it('renders the verdict badge and the headline', () => {
    const { container } = render(<DecisionCard {...base} subject="Option A" />);

    expect(container.querySelector('.ds-verdict--go')).toBeInTheDocument();
    expect(screen.getByText('Book it')).toBeInTheDocument();
    expect(container.querySelector('.ds-decision__headline')).toHaveTextContent(
      'This one is worth taking.',
    );
    expect(container.querySelector('.ds-decision__subject')).toHaveTextContent('Option A');
  });

  /* #81's acceptance criteria: "headingLevel renders the real heading element;
     it does not style a <div>." The headline shipped as a <p>, so a screen
     reader's heading navigation skipped every DecisionCard on the page. */
  it('renders the headline as a real h2 by default', () => {
    render(<DecisionCard {...base} />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.tagName).toBe('H2');
    expect(heading).toHaveTextContent('This one is worth taking.');
    expect(heading).toHaveClass('ds-decision__headline');
  });

  for (const level of [2, 3, 4, 5, 6] as const) {
    it(`renders an h${level} when headingLevel is ${level}`, () => {
      render(<DecisionCard {...base} headingLevel={level} />);

      const heading = screen.getByRole('heading', { level });
      expect(heading.tagName).toBe(`H${level}`);
      expect(heading).toHaveTextContent('This one is worth taking.');
    });
  }

  /* Same runtime guard Accordion carries: a consumer outside the type boundary
     can hand this any number, and HEADING_TAGS[7] is `undefined`, which React
     throws on hard and takes the whole tree down with it. */
  it('falls back to h2 on an out-of-range level rather than crashing the tree', () => {
    render(<DecisionCard {...base} headingLevel={7 as unknown as 2} />);

    expect(screen.getByRole('heading', { level: 2 }).tagName).toBe('H2');
  });

  it('renders each figure and tags it with data-kind when a kind is given', () => {
    const { container } = render(
      <DecisionCard
        {...base}
        figures={[
          { label: 'Base', value: '120', kind: 'cash' },
          { label: 'Extra', value: '18' },
        ]}
      />,
    );

    const figures = container.querySelectorAll('.ds-decision__figure');
    expect(figures).toHaveLength(2);
    expect(figures[0]).toHaveAttribute('data-kind', 'cash');
    expect(figures[1]).not.toHaveAttribute('data-kind');
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('renders the total, the contrast figure and the caveat', () => {
    const { container } = render(
      <DecisionCard
        {...base}
        total={{ label: 'All in', value: '138' }}
        contrast={{ label: 'Compared with', value: '210' }}
        caveat="One leg is not confirmed."
      />,
    );

    expect(container.querySelector('.ds-decision__total')).toHaveTextContent('All in');
    expect(container.querySelector('.ds-decision__total')).toHaveTextContent('138');
    expect(container.querySelector('.ds-decision__contrast')).toHaveTextContent('Compared with');
    expect(container.querySelector('.ds-decision__contrast')).toHaveTextContent('210');
    expect(container.querySelector('.ds-decision__caveat')).toHaveTextContent(
      'One leg is not confirmed.',
    );
  });

  it('product guarantee: without an action it renders no footer element and no button at all', () => {
    const { container } = render(
      <DecisionCard verdict="no" verdictLabel="Do not buy" headline="Not this one." />,
    );

    expect(container.querySelector('.ds-decision__foot')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders closing in the body when there is no action, so the card still gets a last word', () => {
    const { container } = render(
      <DecisionCard
        verdict="no"
        verdictLabel="Do not buy"
        headline="Not this one."
        closing="Check again next week."
      />,
    );

    expect(screen.getByText('Check again next week.')).toBeInTheDocument();
    expect(container.querySelector('.ds-decision__body .ds-decision__closing')).toHaveTextContent(
      'Check again next week.',
    );
    expect(container.querySelector('.ds-decision__foot')).toBeNull();
  });

  it('renders the foot with the passed action node when an action is given', () => {
    const { container } = render(
      <DecisionCard {...base} action={<button type="button">Continue</button>} />,
    );

    const foot = container.querySelector('.ds-decision__foot');
    expect(foot).toBeInTheDocument();
    expect(foot).toContainElement(screen.getByRole('button', { name: 'Continue' }));
  });

  it('forwards its ref to the outer element', () => {
    const ref = createRef<HTMLDivElement>();
    render(<DecisionCard ref={ref} {...base} />);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('ds-decision');
  });
});
