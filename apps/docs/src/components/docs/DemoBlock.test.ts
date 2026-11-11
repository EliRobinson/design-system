import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { DemoBlock } from './DemoBlock';

/* #367: the live stage carries `not-prose`, the boundary every prose rule in
   site.css skips; demo-boundary.test.ts proves the skip in a browser. This
   pins the other half: DemoBlock puts the class on the stage. Called as a
   function, not rendered, because CodeSnippet is an async server component. */
describe('DemoBlock', () => {
  it('marks the live stage, and only the stage, as a prose boundary', () => {
    type Rendered = ReactElement<{ className?: string; children?: ReactElement[] }>;
    const classes = (node?: Rendered) => node?.props.className?.split(' ') ?? [];
    const figure = DemoBlock({ file: 'combobox/Basic.tsx', children: null }) as Rendered;
    const children = figure.props.children as Rendered[];
    const byClass = (name: string) => children.find((child) => classes(child).includes(name));

    expect(classes(figure)).not.toContain('not-prose');
    expect(classes(byClass('demo-block__stage'))).toContain('not-prose');
    // The source panel stays in prose, which styles its code.
    expect(classes(byClass('demo-block__source'))).not.toContain('not-prose');
  });
});
