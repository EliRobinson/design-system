import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { DemoBlock } from './DemoBlock';

/* #367: a demo sits inside the page's `.prose`, and prose rules for headings,
   paragraphs and lists must not reach it. The figure carries `not-prose`, the
   boundary the prose rules skip. Called as a function, not rendered, because
   CodeSnippet is an async server component. */
describe('DemoBlock', () => {
  it('marks the demo as a prose boundary', () => {
    const figure = DemoBlock({ file: 'combobox/Basic.tsx', children: null }) as ReactElement<{
      className: string;
    }>;

    expect(figure.type).toBe('figure');
    expect(figure.props.className.split(' ')).toContain('not-prose');
  });
});
