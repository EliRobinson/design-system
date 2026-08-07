import type { Metadata } from 'next';

import { CodeSnippet } from '../../../../components/docs/CodeSnippet';
import { hooks } from '../../../../lib/manifest';

export const metadata: Metadata = { title: 'Interaction hooks' };

/* Which components consume each hook — usage prose, sourced from
   docs/agents/components.md and the component imports themselves. */
const USED_BY: Record<string, string> = {
  useActiveDescendant: 'Used by Combobox and CommandPalette.',
  useRovingFocus: 'Used by Tabs and SegmentedControl.',
  useClickOutside: 'Used by the anchored overlays — Popover, DropdownMenu, Combobox, DatePicker.',
  useEscapeKey: 'Used by the anchored overlays alongside useClickOutside.',
  useAnchoredPosition: 'Used by Popover, DropdownMenu, Tooltip, Combobox, and DatePicker.',
};

export default function HooksPage() {
  return (
    <>
      <h1>Interaction hooks</h1>
      <p className="lead">
        Five hooks carry the keyboard and dismissal behavior the organisms share. They're exported
        so a composite widget you build yourself can inherit the same contracts instead of
        re-implementing them — prefer these over hand-rolled key handlers.
      </p>
      {hooks.map((hook) => (
        <section key={hook.name}>
          <h2 id={hook.name.toLowerCase()}>{hook.name}</h2>
          <CodeSnippet code={`import { ${hook.name} } from '${hook.importPath}';`} lang="tsx" />
          {hook.description
            .split(/\n\n+/)
            .slice(0, 3)
            .map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph.replace(/\n/g, ' ')}</p>
            ))}
          {USED_BY[hook.name] && <p>{USED_BY[hook.name]}</p>}
        </section>
      ))}
    </>
  );
}
