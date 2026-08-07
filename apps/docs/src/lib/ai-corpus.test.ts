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

  it('is non-empty and lists every component with its import path', () => {
    expect(index.length).toBeGreaterThan(1000);
    for (const component of components) {
      expect(index).toContain(component.importPath);
    }
  });

  it('only publishes import paths that resolve to real source files', () => {
    const paths = index.match(/@elirobinson\/react\/(components|hooks)\/[\w/-]+/g) ?? [];
    expect(paths.length).toBeGreaterThan(40);
    for (const importPath of new Set(paths)) {
      const rel = importPath.replace('@elirobinson/react/', '');
      const file = importPath.includes('/hooks/') ? `${rel}.ts` : `${rel}.tsx`;
      expect(existsSync(join(reactSrc, file)), importPath).toBe(true);
    }
  });

  it('states the no-barrel rule', () => {
    expect(index).toContain('no barrel files');
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

  it('contains no unstripped page JSX or metadata exports', () => {
    expect(full).not.toContain('<DemoBlock');
    expect(full).not.toContain('<ComponentHeader');
    expect(full).not.toContain('export const metadata');
  });
});

describe('per-component records', () => {
  it('serves all 44 slugs with import paths and docs links', () => {
    const slugs = recordSlugs();
    expect(slugs).toHaveLength(44);
    for (const slug of slugs) {
      const record = componentRecord(slug);
      expect(record?.importPath).toContain('@elirobinson/react/components/');
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
