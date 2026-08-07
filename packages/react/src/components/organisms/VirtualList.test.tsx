import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VirtualList } from './VirtualList';

describe('VirtualList', () => {
  it('renders only the rows within the visible viewport, not the full item list', () => {
    const items = Array.from({ length: 1000 }, (_, index) => `Item ${index}`);

    render(
      <VirtualList
        items={items}
        estimateSize={() => 32}
        height={300}
        renderItem={(item) => <div>{item}</div>}
      />,
    );

    const renderedRows = screen.getAllByText(/^Item \d+$/);

    // Positive fact: the first row is actually present.
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    // Positive fact: a far-off row is NOT present — proves windowing, not just
    // "renders something".
    expect(screen.queryByText('Item 999')).not.toBeInTheDocument();
    // Positive fact: some rows rendered (catches a virtualizer that measures a
    // 0px viewport and silently renders zero rows — a weaker test that only
    // checks "not all 1000 render" would pass against that broken state).
    expect(renderedRows.length).toBeGreaterThan(0);
    // Positive fact: fewer than the full set rendered — proves virtualization
    // is actually windowing rather than rendering everything.
    expect(renderedRows.length).toBeLessThan(items.length);
  });
});
