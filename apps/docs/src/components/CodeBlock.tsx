import type { ReactElement, ReactNode } from 'react';

import { highlight } from '../lib/highlight';
import { textOf } from '../lib/slugify';
import { CopyButton } from './CopyButton';

const KNOWN_LANGS = new Set(['tsx', 'ts', 'jsx', 'js', 'css', 'json', 'bash', 'html', 'mdx']);

type CodeChild = ReactElement<{ className?: string; children?: ReactNode }>;

/* MDX hands us <pre><code className="language-tsx">source</code></pre>;
   highlighting happens here (server-side, per block) because Turbopack
   requires MDX plugin options to be serializable, ruling out rehype.

   PromptTemplate reuses this through react-markdown, which builds the same
   shape but puts the code in a one-element array rather than a bare string —
   hence textOf() instead of a typeof check, which would have silently
   rendered every fenced block in the prompt templates as an empty box. */
export async function CodeBlock({ children }: { children?: ReactNode }) {
  const code = children as CodeChild;
  const className = code?.props?.className ?? '';
  const requested = className.replace('language-', '');
  const lang = KNOWN_LANGS.has(requested) ? requested : 'text';
  const source = textOf(code?.props?.children).replace(/\n$/, '');

  const html = await highlight(source, lang);

  return (
    <div className="code-block">
      <CopyButton text={source} />
      <div className="code-block__body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
