import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CodeSnippet } from './CodeSnippet';

/* Renders a prompt template from @elirobinson/ai-patterns verbatim, with a
   copy button — the file that ships in the package is the file shown here.
   Same symlink-path trick as tokens-css.ts: the bundler must not see a
   resolvable module specifier for a non-JS asset. */
export function PromptTemplate({ file }: { file: string }) {
  const content = readFileSync(
    join(process.cwd(), 'node_modules/@elirobinson/ai-patterns/src/prompts', file),
    'utf8',
  ).trim();
  return <CodeSnippet code={content} lang="text" />;
}
