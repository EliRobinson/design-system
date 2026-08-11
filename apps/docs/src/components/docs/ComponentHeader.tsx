import { Badge } from '@elirobinson/react/components/atoms/Badge';

import { getComponent } from '../../lib/manifest';
import { CodeSnippet } from './CodeSnippet';

const SOURCE_BASE =
  'https://github.com/EliRobinson/design-system/blob/main/packages/react/src/components';

export function ComponentHeader({ slug }: { slug: string }) {
  const component = getComponent(slug);
  if (!component) {
    throw new Error(`Unknown component slug: ${slug}`);
  }

  const names = [
    component.name,
    ...component.subComponents.map((s) => s.name),
    ...component.hooks.map((h) => h.name),
  ];
  const importLine = `import { ${names.join(', ')} } from '${component.importSpecifier}';`;

  return (
    <header className="component-header">
      <h1>{component.name}</h1>
      <p className="lead">{component.description}</p>
      <div className="component-header__meta">
        <Badge variant="outline">{component.tier}</Badge>
        <a href={`${SOURCE_BASE}/${component.tier}/${component.name}.tsx`} rel="noreferrer">
          Source
        </a>
      </div>
      <CodeSnippet code={importLine} lang="tsx" />
      {component.stylesheetPaths.length > 0 && (
        <p className="component-header__styles">
          Styles:{' '}
          {component.stylesheetPaths.map((sheet) => (
            <code key={sheet}>{sheet}</code>
          ))}{' '}
          — already included when you import <code>@elirobinson/react/styles.css</code>.
        </p>
      )}
    </header>
  );
}
