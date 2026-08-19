import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { StubCard } from './StubCard.js';

const items = [
  { label: 'Route', value: 'Two legs' },
  { label: 'Window', value: 'Tuesday to Friday' },
];

describe('StubCard', () => {
  it('renders the title and every item label and value', () => {
    render(<StubCard title="Before you send" items={items} stubLabel="Total" stubValue="24" />);

    expect(screen.getByText('Before you send')).toBeInTheDocument();
    for (const item of items) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
      expect(screen.getByText(item.value)).toBeInTheDocument();
    }
  });

  it('renders the stub label and value in the stub column', () => {
    const { container } = render(
      <StubCard title="Before you send" items={items} stubLabel="Total" stubValue="24" />,
    );

    const stub = container.querySelector('.ds-stub__stub');
    expect(stub).toHaveTextContent('Total');
    expect(stub).toHaveTextContent('24');
  });

  it('renders the optional footnote and stub caption when they are given', () => {
    const { container } = render(
      <StubCard
        title="Before you send"
        items={items}
        stubLabel="Total"
        stubValue="24"
        stubCaption="per person"
        footnote="Nothing is charged yet."
      />,
    );

    expect(container.querySelector('.ds-stub__footnote')).toHaveTextContent(
      'Nothing is charged yet.',
    );
    expect(container.querySelector('.ds-stub__stub-caption')).toHaveTextContent('per person');
  });

  it('omits the footnote and caption elements entirely when they are not given', () => {
    const { container } = render(
      <StubCard title="Before you send" items={items} stubLabel="Total" stubValue="24" />,
    );

    expect(container.querySelector('.ds-stub__footnote')).toBeNull();
    expect(container.querySelector('.ds-stub__stub-caption')).toBeNull();
  });

  it('forwards its ref to the outer element', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <StubCard ref={ref} title="Before you send" items={items} stubLabel="Total" stubValue="24" />,
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('ds-stub');
  });
});
