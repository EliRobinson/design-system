import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { DemoBlock } from './DemoBlock';

/* #367: the live stage carries `not-prose`, the boundary every prose rule in
   site.css skips; demo-boundary.test.ts proves the skip in a browser. This
   pins the other half: DemoBlock puts the class on the stage. Called as a
   function, not rendered, because CodeSnippet is an async server component. */
describe('DemoBlock', () => {
  it('marks the live stage, and only the stage, as a prose boundary', () => {
    type Element = ReactElement<{ className?: string; children?: ReactElement[] }>;
    const figure = DemoBlock({ file: 'combobox/Basic.tsx', children: null }) as Element;
    const children = figure.props.children as Element[];
    const byClass = (name: string) =>
      children.find((child) => child.props.className?.split(' ').includes(name));
    const stage = byClass('demo-block__stage');
    const source = byClass('demo-block__source');

    expect(figure.props.className?.split(' ')).not.toContain('not-prose');
    expect(stage?.props.className?.split(' ')).toContain('not-prose');
    // The source panel stays in prose, which styles its code.
    expect(source?.props.className?.split(' ')).not.toContain('not-prose');
  });
});
