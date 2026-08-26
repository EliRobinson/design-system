import type { MDXComponents } from 'mdx/types';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';

import { CodeBlock } from './src/components/CodeBlock';
import { slugify, textOf } from './src/lib/slugify';

function heading(Tag: 'h1' | 'h2' | 'h3' | 'h4') {
  return function Heading({ children, ...props }: { children?: ReactNode }) {
    const id = slugify(textOf(children));
    return (
      <Tag id={id} {...props}>
        {Tag === 'h1' ? children : <a href={`#${id}`}>{children}</a>}
      </Tag>
    );
  };
}

export function Anchor({ href = '', ...props }: ComponentPropsWithoutRef<'a'>) {
  if (href.startsWith('/')) {
    return <Link href={href} {...props} />;
  }
  const external = href.startsWith('http');
  return <a href={href} rel={external ? 'noreferrer' : undefined} {...props} />;
}

export function TableScroll(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="table-scroll">
      <table {...props} />
    </div>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: heading('h1'),
    h2: heading('h2'),
    h3: heading('h3'),
    h4: heading('h4'),
    pre: CodeBlock,
    a: Anchor,
    table: TableScroll,
    ...components,
  };
}
