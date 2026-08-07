import type { ReactElement, ReactNode } from 'react';

import { highlight } from '../lib/highlight';
import { CopyButton } from './CopyButton';

const KNOWN_LANGS = new Set(['tsx', 'ts', 'jsx', 'js', 'css', 'json', 'bash', 'html', 'mdx']);

type CodeChild = ReactElement<{ className?: string; children?: ReactNode }>;

/* MDX hands us <pre><code className="language-tsx">source</code></pre>;
   highlighting happens here (server-side, per block) because Turbopack
   requires MDX plugin options to be serializable, ruling out rehype. */
export async function CodeBlock({ children }: { children?: ReactNode }) {
  const code = children as CodeChild;
  const className = code?.props?.className ?? '';
  const requested = className.replace('language-', '');
  const lang = KNOWN_LANGS.has(requested) ? requested : 'text';
  const source =
    typeof code?.props?.children === 'string' ? code.props.children.replace(/\n$/, '') : '';

  const html = await highlight(source, lang);

  return (
    <div className="code-block">
      <CopyButton text={source} />
      <div className="code-block__body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
