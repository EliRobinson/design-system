import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/* #258 added three opt-ins — `code`, `figureLayout` and a figure `id` — and
   promised that a card using none of them renders exactly what it did before.
   The markup below is what DecisionCard 3.3.2 rendered for these props,
   captured from that release rather than written by hand, so any drift in the
   default path fails here instead of in a consumer's baseline. */
describe('DecisionCard without the #258 opt-ins', () => {
  it('renders the markup 3.3.2 rendered, byte for byte', () => {
    const { container } = render(
      <DecisionCard
        verdict="go"
        verdictLabel="Worth it"
        subject="Team plan renewal"
        headline="Renewing now costs less than waiting."
        headingLevel={3}
        figures={[
          { label: 'Current rate', value: '$240 / yr' },
          { label: 'Renewal rate', value: '$216 / yr', kind: 'cash' },
        ]}
        total={{ label: 'You pay today', value: '$216' }}
        contrast={{ label: 'If you wait', value: '$264' }}
        caveat="Holds for 14 days."
        closing="Renew this week."
        action={<button type="button">Renew now</button>}
      />,
    );

    expect(container.innerHTML).toBe(
      '<div class="ds-decision">' +
        '<div class="ds-decision__head">' +
        '<span class="ds-verdict ds-verdict--go">' +
        '<span class="ds-verdict__glyph" aria-hidden="true">✓</span>' +
        '<span class="ds-verdict__word">Worth it</span>' +
        '</span>' +
        '<p class="ds-decision__subject">Team plan renewal</p>' +
        '</div>' +
        '<div class="ds-decision__body">' +
        '<h3 class="ds-decision__headline">Renewing now costs less than waiting.</h3>' +
        '<dl class="ds-decision__figures">' +
        '<div class="ds-decision__figure">' +
        '<dt class="ds-decision__figure-label">Current rate</dt>' +
        '<dd class="ds-decision__figure-value">$240 / yr</dd>' +
        '</div>' +
        '<div class="ds-decision__figure" data-kind="cash">' +
        '<dt class="ds-decision__figure-label">Renewal rate</dt>' +
        '<dd class="ds-decision__figure-value">$216 / yr</dd>' +
        '</div>' +
        '</dl>' +
        '<p class="ds-decision__total">' +
        '<span class="ds-decision__figure-label">You pay today</span>' +
        '<span class="ds-decision__figure-value">$216</span>' +
        '</p>' +
        '<p class="ds-decision__contrast">' +
        '<span class="ds-decision__figure-label">If you wait</span>' +
        '<span class="ds-decision__figure-value">$264</span>' +
        '</p>' +
        '<p class="ds-decision__caveat">Holds for 14 days.</p>' +
        '<p class="ds-decision__closing">Renew this week.</p>' +
        '</div>' +
        '<div class="ds-decision__foot">' +
        '<button type="button">Renew now</button>' +
        '</div>' +
        '</div>',
    );
  });

  it('renders the same markup when figureLayout is metric explicitly', () => {
    const figures = [{ label: 'Base', value: '120' }];
    const implicit = render(<DecisionCard {...base} figures={figures} />).container.innerHTML;
    const explicit = render(<DecisionCard {...base} figures={figures} figureLayout="metric" />)
      .container.innerHTML;

    expect(explicit).toBe(implicit);
  });
});

describe('DecisionCard code', () => {
  it('sets the code apart inside the heading, so the accessible name is one phrase', () => {
    const { container } = render(
      <DecisionCard {...base} code="99417" headline="Prolonged office E/M" headingLevel={3} />,
    );

    const heading = screen.getByRole('heading', { level: 3, name: '99417 Prolonged office E/M' });
    expect(heading).toHaveClass('ds-decision__headline', 'ds-decision__headline--coded');
    expect(heading).not.toHaveAttribute('aria-label');
    expect(heading.querySelector('.ds-decision__code')).toHaveTextContent(/^99417$/);
    expect(heading.querySelector('.ds-decision__headline-text')).toHaveTextContent(
      /^Prolonged office E\/M$/,
    );
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(1);
  });

  it('renders a plain heading with no code span when code is absent or empty', () => {
    for (const code of [undefined, '']) {
      const { container, unmount } = render(<DecisionCard {...base} code={code} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.className).toBe('ds-decision__headline');
      expect(heading.childNodes).toHaveLength(1);
      expect(container.querySelector('.ds-decision__code')).toBeNull();
      unmount();
    }
  });
});

describe('DecisionCard figureLayout', () => {
  const rows = [
    { id: 'criterion-0', label: 'from', value: '2 chronic problems addressed, both with a plan' },
    { id: 'criterion-1', label: 'from', value: 'Prescription drug management' },
    { id: 'rule', label: 'rule', value: 'Moderate MDM, established patient, home' },
  ];

  it('marks the list for the prose grid and keeps the dl/dt/dd pairing', () => {
    const { container } = render(<DecisionCard {...base} figures={rows} figureLayout="prose" />);

    const list = container.querySelector('dl');
    expect(list).toHaveClass('ds-decision__figures', 'ds-decision__figures--prose');
    const figures = container.querySelectorAll('.ds-decision__figure');
    expect(figures).toHaveLength(3);
    for (const [index, figure] of [...figures].entries()) {
      expect(figure.querySelector('dt')).toHaveTextContent(rows[index]!.label);
      expect(figure.querySelector('dd')).toHaveTextContent(rows[index]!.value);
    }
  });

  it('leaves the list unmarked in the default metric layout', () => {
    const { container } = render(<DecisionCard {...base} figures={rows} />);

    expect(container.querySelector('dl')?.className).toBe('ds-decision__figures');
  });
});

describe('DecisionCard figure keys', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function keyWarnings() {
    return consoleError.mock.calls.filter((call) => String(call[0]).includes('same key'));
  }

  /* The consumer case #258 was filed for: derivation rows repeat their label
     by design. Before, the key was `${kind}:${label}`, so repeated labels
     collided unless the row's identity was smuggled into `kind` — which then
     reached the DOM as `data-kind`. */
  it('keys by id, so repeated labels need no kind and put nothing in the DOM', () => {
    const { container } = render(
      <DecisionCard
        {...base}
        figures={[
          { id: 'a', label: 'from', value: 'One' },
          { id: 'b', label: 'from', value: 'Two' },
        ]}
      />,
    );

    expect(keyWarnings()).toEqual([]);
    const figures = container.querySelectorAll('.ds-decision__figure');
    expect(figures).toHaveLength(2);
    for (const figure of figures) {
      expect(figure).not.toHaveAttribute('data-kind');
      expect(figure).not.toHaveAttribute('id');
    }
  });

  it('falls back to the position when a figure has no id', () => {
    render(
      <DecisionCard
        {...base}
        figures={[
          { label: 'from', value: 'One' },
          { label: 'from', value: 'Two' },
        ]}
      />,
    );

    expect(keyWarnings()).toEqual([]);
  });

  it('treats an empty id as no id, so two of them do not share a key', () => {
    render(
      <DecisionCard
        {...base}
        figures={[
          { id: '', label: 'from', value: 'One' },
          { id: '', label: 'from', value: 'Two' },
        ]}
      />,
    );

    expect(keyWarnings()).toEqual([]);
  });

  /* The namespacing in `figureKey`. */
  it('never lets an id collide with a position', () => {
    render(
      <DecisionCard
        {...base}
        figures={[
          { id: '1', label: 'A', value: 'One' },
          { label: 'B', value: 'Two' },
        ]}
      />,
    );

    expect(keyWarnings()).toEqual([]);
  });
});
