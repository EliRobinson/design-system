import Markdown, { type Components } from 'react-markdown';

import { Anchor, TableScroll } from '../../../mdx-components';
import { PROMPT_FILES, promptRemarkPlugins, readPromptSource } from '../../lib/prompt-markdown';
import { CodeBlock } from '../CodeBlock';
import { CopyButton } from '../CopyButton';

/* Renders a prompt template from @elirobinson/ai-patterns — parsed as the
   markdown it is, and offered verbatim for copying. The file that ships in the
   package is the file you copy from here.

   It used to be handed to CodeSnippet with lang="text". Shiki tokenises
   nothing for "text", so the page showed a grey slab of literal markdown
   source: `## Intent`, `**bold**`, backticks and all (#129).

   Two rules shape the fix:

   1. The copy payload is the raw file, not the rendered text. These are
      prompts; a Copy button that yields prose is a broken feature. Both the
      renderer and the CopyButton below are handed the same `source` string.
   2. The rendering runs at build time. /build-with-ai must stay prerendered
      (scripts/assert-static-routes.mjs enforces it), so this is a plain
      server component — react-markdown's default export is synchronous and
      hook-free, and the async CodeBlock elements it returns are awaited by
      React during the prerender. */

/* The same components the surrounding MDX page renders through, minus the
   headings. The page's own map slugs every heading into an id and an anchor;
   three prompt templates on one page each contribute "Intent", "Constraints"
   and "Verification checklist", so that map would emit `id="intent"` three
   times over — invalid HTML, and #constraints would jump to whichever came
   first. Prompt headings are body content, not page landmarks: they get no
   ids, and they are demoted so the outline stays sane (each template sits
   under an <h3>, and the page already owns the only <h1>). */
const promptComponents: Components = {
  h1: 'h4',
  h2: 'h5',
  h3: 'h6',
  h4: 'h6',
  pre: CodeBlock,
  a: Anchor,
  table: TableScroll,
};

export function PromptTemplate({ file }: { file: (typeof PROMPT_FILES)[number] }) {
  const source = readPromptSource(file);
  return (
    <div className="prompt-template">
      <div className="prompt-template__bar">
        <span className="prompt-template__file">{file}</span>
        <CopyButton text={source} />
      </div>
      <div className="prompt-template__body">
        <Markdown remarkPlugins={promptRemarkPlugins} components={promptComponents}>
          {source}
        </Markdown>
      </div>
    </div>
  );
}
