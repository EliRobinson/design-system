/* Builds the machine-readable surface: /llms.txt, /llms-full.txt, and the
   /r/[component].json records. Everything here derives from the generated
   manifest, the live tokens.css, the ai-patterns contracts, and the same MDX
   prose the human pages render — no hand-kept second copy of anything. */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import contracts from '@elirobinson/ai-patterns/contracts';

import type { ComponentRecord } from './manifest';
import { components, hooks } from './manifest';
import { siteSections } from './site-map';
import { cssTokens } from './tokens-css';

const APP_DIR = join(process.cwd(), 'src/app/(docs)');

const INTRO =
  'Miltinson Design System — tokens, React 19 components, and AI patterns for ' +
  'Miltinson Technologies products. Ink-led palette with one amber accent, sharp radii, ' +
  'hairline borders, WCAG AA by default. Packages: @elirobinson/tokens, ' +
  '@elirobinson/react, @elirobinson/ai-patterns (GitHub Packages registry).';

const IMPORT_RULES = [
  'There are no barrel files. Every import names a subpath:',
  "  import '@elirobinson/tokens/tokens.css';",
  "  import '@elirobinson/react/styles.css';",
  "  import { Button } from '@elirobinson/react/components/atoms/Button';",
  "  import { useRovingFocus } from '@elirobinson/react/hooks/useRovingFocus';",
  "A bare import from '@elirobinson/react' does not resolve.",
].join('\n');

function pagePath(href: string): string {
  return join(APP_DIR, href.replace(/^\//, ''), 'page.mdx');
}

/* MDX → plain markdown: drop imports/exports and JSX tag lines, convert
   DoDont blocks to lists, keep prose, headings, and code fences. */
export function stripMdx(source: string): string {
  const withDoDont = source.replace(/<DoDont[\s\S]*?\/>/g, (block) => {
    const list = (name: string) => {
      const match = block.match(new RegExp(`${name}=\\{\\[([\\s\\S]*?)\\]\\}`));
      if (!match) {
        return [];
      }
      return [...match[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
    };
    const doItems = list('do').map((item) => `- ${item}`);
    const dontItems = list('dont').map((item) => `- ${item}`);
    return `Do:\n${doItems.join('\n')}\n\nDon't:\n${dontItems.join('\n')}`;
  });

  const out: string[] = [];
  let inFence = false;
  for (const line of withDoDont.split('\n')) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export const metadata')) {
      continue;
    }
    if (/^<\/?[A-Za-z]/.test(trimmed) || trimmed === '/>' || trimmed === '>') {
      continue;
    }
    out.push(line);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pageProse(href: string): string | null {
  const path = pagePath(href);
  if (!existsSync(path)) {
    return null;
  }
  return stripMdx(readFileSync(path, 'utf8'));
}

function propsTable(props: ComponentRecord['props']): string {
  if (props.length === 0) {
    return '(no props of its own beyond inherited HTML attributes)';
  }
  const rows = props.map(
    (p) =>
      `| ${p.name} | \`${p.type.replace(/\|/g, '\\|')}\` | ${p.required ? 'yes' : 'no'} | ${
        p.defaultValue ?? '—'
      } | ${p.description || '—'} |`,
  );
  return [
    '| Prop | Type | Required | Default | Description |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function componentSection(component: ComponentRecord): string {
  const parts = [
    `### ${component.name} (${component.tier})`,
    '',
    component.description,
    '',
    `Import: \`import { ${[
      component.name,
      ...component.subComponents.map((s) => s.name),
      ...component.hooks.map((h) => h.name),
    ].join(', ')} } from '${component.importPath}';\``,
  ];
  if (component.stylesheetPaths.length > 0) {
    parts.push(`Styles: ${component.stylesheetPaths.join(', ')} (included in styles.css)`);
  }
  if (component.inherits) {
    parts.push(`Also accepts all \`${component.inherits}\` props.`);
  }
  parts.push('', propsTable(component.props));
  for (const sub of component.subComponents) {
    parts.push('', `#### ${sub.name}`, '', propsTable(sub.props));
    if (sub.inherits) {
      parts.push(`Also accepts all \`${sub.inherits}\` props.`);
    }
  }
  if (component.constraints.length > 0) {
    parts.push('', `Constraints: ${component.constraints.join(', ')} (see System constraints)`);
  }
  if (component.extractionGaps.length > 0) {
    parts.push(`Notes: ${component.extractionGaps.join('; ')}`);
  }
  const prose = pageProse(`/components/${component.slug}`);
  if (prose) {
    /* Drop the H1 (the section heading above carries the name) and demote the
       page's H2s so they nest under this component's H3. */
    parts.push(
      '',
      prose
        .replace(/^# .*\n/, '')
        .replace(/^## /gm, '#### ')
        .trim(),
    );
  }
  parts.push('', `Machine-readable record: /r/${component.slug}.json`);
  return parts.join('\n');
}

export function llmsIndex(): string {
  const lines = [
    '# Miltinson Design System',
    '',
    `> ${INTRO}`,
    '',
    '## Install',
    '',
    'GitHub Packages registry — .npmrc with @elirobinson:registry=https://npm.pkg.github.com',
    'and a PAT with read:packages as NODE_AUTH_TOKEN. Then:',
    '  pnpm add @elirobinson/tokens @elirobinson/react',
    '',
    IMPORT_RULES,
    '',
    '## Machine-readable docs',
    '',
    '- /llms-full.txt — the full corpus: tokens, constraints, every component with its prop table, patterns',
    '- /r/<slug>.json — one component record (e.g. /r/button.json)',
    '',
    '## Components',
    '',
    ...components.map(
      (c) => `- ${c.name} (${c.tier}) — ${c.description} — import '${c.importPath}'`,
    ),
    '',
    '## Hooks',
    '',
    ...hooks.map(
      (h) => `- ${h.name} — ${h.description.split(/[.\n]/)[0].trim()}. — import '${h.importPath}'`,
    ),
    '',
  ];
  return lines.join('\n');
}

export function llmsFull(): string {
  const constraintEntries = Object.entries(
    contracts.componentConstraints as Record<string, { summary: string; check: string }>,
  );

  const parts: string[] = [
    '# Miltinson Design System — full corpus',
    '',
    `> ${INTRO}`,
    '',
    '## System constraints (machine-checkable ids from @elirobinson/ai-patterns/contracts)',
    '',
    ...constraintEntries.map(([id, c]) => `- **${id}** — ${c.summary} Check: ${c.check}`),
    '',
    `UI contracts: minimum touch target ${contracts.uiContracts.minimumTouchTarget} (scoped — see touch-target-dense), ` +
      `focus-visible required: ${contracts.uiContracts.focusVisibleRequired}, contrast level ${contracts.uiContracts.contrastLevel}.`,
    '',
    '## Import rules',
    '',
    IMPORT_RULES,
    '',
    '## Design tokens (from @elirobinson/tokens/tokens.css)',
    '',
    ...cssTokens().map((t) => `- \`${t.name}: ${t.value}\`${t.comment ? ` — ${t.comment}` : ''}`),
  ];

  const foundations = siteSections().find((s) => s.title === 'Foundations');
  if (foundations) {
    parts.push('', '## Foundations');
    for (const page of foundations.pages) {
      const prose = pageProse(page.href);
      if (prose) {
        parts.push('', prose);
      }
    }
  }

  parts.push('', '## Components');
  for (const tier of ['atoms', 'molecules', 'organisms'] as const) {
    for (const component of components.filter((c) => c.tier === tier)) {
      parts.push('', componentSection(component));
    }
  }

  parts.push('', '## Hooks');
  for (const hook of hooks) {
    parts.push(
      '',
      `### ${hook.name}`,
      '',
      `Import: \`import { ${hook.name} } from '${hook.importPath}';\``,
    );
    if (hook.description) {
      parts.push('', hook.description);
    }
  }

  const patterns = siteSections().find((s) => s.title === 'Patterns');
  if (patterns) {
    parts.push(
      '',
      '## Patterns',
      '',
      'These are recipes composed from the primitives above — they are NOT importable components.',
    );
    for (const page of patterns.pages) {
      const prose = pageProse(page.href);
      if (prose) {
        parts.push('', prose);
      }
    }
  }

  return parts.join('\n');
}

export function recordSlugs(): string[] {
  return components.map((c) => c.slug);
}

export function componentRecord(slug: string): (ComponentRecord & { docs: string }) | null {
  const component = components.find((c) => c.slug === slug);
  if (!component) {
    return null;
  }
  return { ...component, docs: `/components/${component.slug}` };
}
