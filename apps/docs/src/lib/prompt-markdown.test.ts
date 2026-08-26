import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Markdown from 'react-markdown';
import { describe, expect, it } from 'vitest';

import { PROMPT_FILES, promptRemarkPlugins, readPromptSource } from './prompt-markdown';

/* Renders a prompt the way PromptTemplate does, minus the components map:
   CodeBlock is an async server component and renderToStaticMarkup cannot await
   one, so fenced blocks are left as the plain <pre><code> that react-markdown
   emits — which is exactly the shape CodeBlock is handed in the app. */
function render(source: string): string {
  return renderToStaticMarkup(
    createElement(Markdown, { remarkPlugins: promptRemarkPlugins }, source),
  );
}

describe('prompt template sources', () => {
  it('reads the file that ships in the package, byte for byte', () => {
    for (const file of PROMPT_FILES) {
      const onDisk = readFileSync(
        join(process.cwd(), 'node_modules/@elirobinson/ai-patterns/src/prompts', file),
        'utf8',
      );
      expect(readPromptSource(file)).toBe(onDisk.trim());
    }
  });

  /* The regression guard for #129's fix, not for #129 itself. The bug was that
     the page showed raw markdown; the obvious fix — render it — breaks the
     feature if the Copy button starts handing over the rendered text. These
     are prompts: an agent needs the `## Intent` headings and the backticks.
     So the copy payload must still be markdown source, with its syntax in it. */
  it('hands the copy button markdown source, not rendered prose', () => {
    for (const file of PROMPT_FILES) {
      const source = readPromptSource(file);
      expect(source).toMatch(/^# Prompt: /);
      expect(source).toContain('\n## Intent\n');
      expect(source).toContain('**');
      expect(source).toContain('`@elirobinson/');
      expect(source).toContain('- [ ] ');
    }
  });

  it('lists every template the build-with-ai page embeds', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/(docs)/build-with-ai/page.mdx'), 'utf8');
    const embedded = [...page.matchAll(/<PromptTemplate file="([^"]+)"/g)].map((m) => m[1]);
    expect(embedded.length).toBeGreaterThan(0);
    expect([...embedded].sort()).toEqual([...PROMPT_FILES].sort());
  });
});

describe('prompt template rendering', () => {
  it('turns markdown structure into elements rather than literal text', () => {
    const html = render(readPromptSource('add-component.md'));
    expect(html).toContain('<h1>');
    expect(html).toContain('<h2>Intent</h2>');
    expect(html).toContain('<strong>');
    expect(html).toContain('<li>');
    expect(html).toContain('<hr');
    expect(html).toContain('<code>');
    /* The symptom in the issue: heading markers surviving into the output. */
    expect(html).not.toContain('## Intent');
  });

  it('keeps fenced code blocks fenced, with their language', () => {
    /* adopt-system.md carries a ```bash block and a ```css block. A
       line-based parser is the usual way to get this wrong; the whole point of
       using a real markdown parser is that fences survive intact. */
    const html = render(readPromptSource('adopt-system.md'));
    expect(html).toContain('<pre><code class="language-bash">');
    expect(html).toContain('<pre><code class="language-css">');
    expect(html).toContain('pnpm ds props &lt;Name&gt;');
    expect(html).toContain('--ds-font-sans-override: var(--font-geist-sans);');
    expect(html).not.toContain('```');
  });

  it('renders GFM task lists as checkboxes', () => {
    /* Without remark-gfm these come out as bullets containing a literal
       "[ ]" — every verification checklist in every template. */
    const html = render(readPromptSource('audit-page.md'));
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('contains-task-list');
    expect(html).not.toContain('<li>[ ]');
  });
});
