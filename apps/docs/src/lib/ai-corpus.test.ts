/* The docs site's half of the corpus contract.
 *
 * The generator itself lives in @elirobinson/ai-patterns and is tested there,
 * against a fixture manifest — prop tables, tier ordering, escaping, the
 * optional inputs. What is tested here is what this app supplies to it and
 * nothing else: real manifest data, MDX prose reduced to plain markdown, the
 * record links, and the /r/ records the routes serve. */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { componentRecord, llmsFull, llmsIndex, recordSlugs, stripMdx } from './ai-corpus';
import { components } from './manifest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const reactSrc = join(repoRoot, 'packages/react/src');

describe('llms.txt index', () => {
  const index = llmsIndex();

  it('is non-empty and lists every component with its import specifier', () => {
    expect(index.length).toBeGreaterThan(1000);
    for (const component of components) {
      expect(index).toContain(component.importSpecifier);
    }
  });

  it('only publishes import specifiers that resolve to real source files', () => {
    const paths = index.match(/@elirobinson\/react\/(components|hooks)\/[\w/-]+/g) ?? [];
    expect(paths.length).toBeGreaterThan(40);
    for (const specifier of new Set(paths)) {
      const rel = specifier.replace('@elirobinson/react/', '');
      const file = specifier.includes('/hooks/') ? `${rel}.ts` : `${rel}.tsx`;
      expect(existsSync(join(reactSrc, file)), specifier).toBe(true);
    }
  });

  it('points a reader at the site’s own machine-readable routes', () => {
    expect(index).toContain('## Machine-readable docs');
    expect(index).toContain('/r/<slug>.json');
  });

  it('is a live surface, not a snapshot, so it carries no version stamp', () => {
    expect(index).not.toContain('Snapshot of @elirobinson/react');
  });
});

describe('llms-full.txt corpus', () => {
  const full = llmsFull();

  it('carries the token surface, constraints, every component, and the patterns', () => {
    expect(full).toContain('--signal-500');
    expect(full).toContain('touch-target-dense');
    for (const component of components) {
      expect(full).toContain(`### ${component.name} (${component.tier})`);
    }
    expect(full).toContain('NOT importable components');
  });

  it('renders the Button prop table', () => {
    expect(full).toContain('| variant |');
    expect(full).toContain('"primary" \\| "accent" \\| "secondary" \\| "ghost"');
  });

  it('interleaves the MDX prose the human pages render', () => {
    /* The prose is the whole reason this corpus differs from the packed
       snapshot — if the MDX stopped being read, everything else would still
       look right. */
    expect(full).toContain('## Foundations');

    const start = full.indexOf('### Button (atoms)');
    const rest = full.slice(start + 1);
    const buttonSection = rest.slice(0, rest.indexOf('\n### '));

    /* The page's own H2s, demoted to H4 so they nest under the component. */
    expect(buttonSection).toContain('\n#### ');
  });

  it('links every component section to its machine-readable record', () => {
    for (const component of components) {
      expect(full).toContain(`Machine-readable record: /r/${component.slug}.json`);
    }
  });

  it('contains no unstripped page JSX or metadata exports', () => {
    expect(full).not.toContain('<DemoBlock');
    expect(full).not.toContain('<ComponentHeader');
    expect(full).not.toContain('export const metadata');
  });
});

describe('per-component records', () => {
  it('serves all 44 slugs with import specifiers and docs links', () => {
    const slugs = recordSlugs();
    expect(slugs).toHaveLength(44);
    for (const slug of slugs) {
      const record = componentRecord(slug);
      expect(record?.importSpecifier).toContain('@elirobinson/react/components/');
      expect(record?.docs).toBe(`/components/${slug}`);
    }
  });

  it('returns null for unknown slugs', () => {
    expect(componentRecord('does-not-exist')).toBeNull();
  });
});

describe('stripMdx', () => {
  it('converts DoDont blocks to plain lists', () => {
    const out = stripMdx(`<DoDont\n  do={['Keep it.', 'Ship it.']}\n  dont={['Don\\'t pad.']}\n/>`);
    expect(out).toContain('- Keep it.');
    expect(out).toContain("- Don't pad.");
    expect(out).not.toContain('<DoDont');
  });

  it('keeps fenced code and prose, drops imports and JSX', () => {
    const out = stripMdx(
      "import X from 'y';\n\nSome prose.\n\n```tsx\nimport { Button } from 'z';\n```\n\n<X />\n",
    );
    expect(out).toContain('Some prose.');
    expect(out).toContain("import { Button } from 'z';");
    expect(out).not.toContain("import X from 'y';");
    expect(out).not.toContain('<X />');
  });
});
