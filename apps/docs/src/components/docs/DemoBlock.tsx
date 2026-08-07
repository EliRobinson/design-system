import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

import { CodeSnippet } from './CodeSnippet';

/* Renders a live demo next to its own source file, so the code a reader
   copies is the code that just rendered — the two cannot drift. */
export function DemoBlock({ file, children }: { file: string; children: ReactNode }) {
  const source = readFileSync(join(process.cwd(), 'src/components/demos', file), 'utf8')
    .replace(/^'use client';\n\n?/, '')
    .trimEnd();

  return (
    <figure className="demo-block">
      <div className="demo-block__stage">{children}</div>
      <details className="demo-block__source">
        <summary>Show code</summary>
        <CodeSnippet code={source} lang="tsx" />
      </details>
    </figure>
  );
}
