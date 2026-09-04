import { readExample, type ExampleRoot } from '../../lib/examples';
import { CodeSnippet } from './CodeSnippet';

/* One worked example, with the path of the file it came from above it.

   The path is shown for the same reason PromptTemplate shows a filename: it
   tells a reader that this is a file in a repository rather than a snippet
   typed into a page, and it is the thing to point at when the example and the
   API disagree. */

const LABELS: Record<ExampleRoot, string> = {
  'ai-patterns': 'packages/ai-patterns/docs/examples',
  docs: 'apps/docs/src/examples/ai-elements',
};

export function ExampleSource({
  root,
  file,
  lang,
}: {
  root: ExampleRoot;
  file: string;
  lang?: string;
}) {
  const code = readExample(root, file);
  return (
    <figure className="example-source">
      <figcaption className="example-source__path">
        <code>{`${LABELS[root]}/${file}`}</code>
      </figcaption>
      <CodeSnippet code={code} lang={lang ?? (file.endsWith('.tsx') ? 'tsx' : 'ts')} />
    </figure>
  );
}
