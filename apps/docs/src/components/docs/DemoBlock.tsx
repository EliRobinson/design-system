import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

import { CodeSnippet } from './CodeSnippet';

/* Renders a live demo next to its own source file, so the code a reader
   copies is the code that just rendered — the two cannot drift.

   `not-prose` marks the live stage as a boundary: the page's prose styles
   headings, paragraphs and lists, and a demo is not prose. The source panel
   stays inside prose, which styles its code. Tailwind Typography honours the
   same class, so a consumer copying the pattern gets the same escape hatch
   (#367). */
export function DemoBlock({ file, children }: { file: string; children: ReactNode }) {
  const source = readFileSync(join(process.cwd(), 'src/components/demos', file), 'utf8')
    .replace(/^'use client';\n\n?/, '')
    .trimEnd();

  return (
    <figure className="demo-block">
      <div className="demo-block__stage not-prose">{children}</div>
      <details className="demo-block__source">
        <summary>Show code</summary>
        <CodeSnippet code={source} lang="tsx" />
      </details>
    </figure>
  );
}
