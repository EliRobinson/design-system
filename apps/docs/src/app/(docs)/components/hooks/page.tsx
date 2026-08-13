import type { Metadata } from 'next';

import { CodeSnippet } from '../../../../components/docs/CodeSnippet';
import { HOOK_USED_BY } from '../../../../lib/editorial';
import { hooks } from '../../../../lib/manifest';

export const metadata: Metadata = { title: 'Interaction hooks' };

export default function HooksPage() {
  return (
    <>
      <h1>Interaction hooks</h1>
      <p className="lead">
        {hooks.length} hooks carry the state, keyboard, dismissal, and mount-gating behavior the
        organisms share. They're exported so a composite widget you build yourself can inherit the
        same contracts instead of re-implementing them — prefer these over hand-rolled key handlers.
      </p>
      {hooks.map((hook) => (
        <section key={hook.name}>
          <h2 id={hook.name.toLowerCase()}>{hook.name}</h2>
          <CodeSnippet
            code={`import { ${hook.name} } from '${hook.importSpecifier}';`}
            lang="tsx"
          />
          {hook.description
            .split(/\n\n+/)
            .slice(0, 3)
            .map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph.replace(/\n/g, ' ')}</p>
            ))}
          {HOOK_USED_BY[hook.name] && <p>{HOOK_USED_BY[hook.name]}</p>}
        </section>
      ))}
    </>
  );
}
