// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

import { buildManifest } from './manifest.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptsDir, '..');

/**
 * The members of one exported object type in manifest-types.d.ts — the
 * declaration file shipped alongside dist/manifest.json. Nothing infers it from
 * the builder, so a test has to be what keeps the two honest.
 */
function declaredFields(typeName) {
  const path = join(scriptsDir, 'manifest-types.d.ts');
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

  const declaration = source.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === typeName,
  );
  if (!declaration || !ts.isTypeLiteralNode(declaration.type)) {
    throw new Error(`manifest-types.d.ts declares no object type named ${typeName}`);
  }

  return declaration.type.members.filter(ts.isPropertySignature).map((member) => member.name.text);
}

/** A throwaway package whose src/ layout we control. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'ds-manifest-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: '@elirobinson/react', version: '0.0.0-fixture' }),
  );

  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }

  cleanups.push(root);
  return root;
}

const cleanups = [];
afterEach(() => {
  while (cleanups.length) rmSync(cleanups.pop(), { recursive: true, force: true });
});

describe('buildManifest against this package', () => {
  const manifest = buildManifest(packageRoot);
  const byName = (name) => manifest.components.find((entry) => entry.name === name);

  it('emits exactly the fields its published declaration file describes', () => {
    const fields = (object) => Object.keys(object).sort();

    expect(fields(manifest)).toEqual(declaredFields('Manifest').sort());
    expect(fields(manifest.components[0])).toEqual(declaredFields('ComponentRecord').sort());
    expect(fields(manifest.hooks[0])).toEqual(declaredFields('HookRecord').sort());
    expect(fields(byName('Card').subComponents[0])).toEqual(
      declaredFields('SubComponentRecord').sort(),
    );
    expect(fields(byName('Button').props[0])).toEqual(declaredFields('PropRecord').sort());
    expect(fields(byName('Button').variants[0])).toEqual(declaredFields('VariantRecord').sort());
    expect(fields(byName('Toast').hooks[0])).toEqual(declaredFields('DeclaredHook').sort());
  });

  it('covers every tier and every component directory', () => {
    expect(manifest.tiers).toEqual(expect.arrayContaining(['atoms', 'molecules', 'organisms']));
    expect(manifest.components.length).toBeGreaterThan(40);
    expect(manifest.package).toBe('@elirobinson/react');
  });

  it('records the import specifier a consumer must type', () => {
    expect(byName('Button')).toMatchObject({
      slug: 'button',
      tier: 'atoms',
      subpath: 'atoms/Button',
      importSpecifier: '@elirobinson/react/components/atoms/Button',
      importPath: '@elirobinson/react/components/atoms/Button',
      propsType: 'ButtonProps',
      stylesheetPaths: ['@elirobinson/react/styles/atoms/Button.css'],
      inherits: 'ButtonHTMLAttributes<HTMLButtonElement>',
    });
  });

  it('resolves the prop table, defaults and all, through the type checker', () => {
    const variant = byName('Button').props.find((prop) => prop.name === 'variant');

    expect(variant).toMatchObject({
      type: '"primary" | "accent" | "secondary" | "ghost"',
      required: false,
      defaultValue: 'primary',
    });
  });

  it('describes every component, from source JSDoc or the curated fallback', () => {
    for (const component of manifest.components) {
      expect(component.description.length, component.name).toBeGreaterThan(0);
    }
  });

  it('names the constraints a component has to satisfy', () => {
    expect(byName('Button').constraints).toEqual(
      expect.arrayContaining(['forward-ref', 'touch-target-primary', 'hit-area-no-overlap']),
    );
  });

  it('groups the parts of a compound component under it', () => {
    expect(byName('Card').subComponents.map((sub) => sub.name)).toEqual([
      'CardHeader',
      'CardTitle',
      'CardDescription',
      'CardContent',
      'CardFooter',
    ]);
  });

  it('lists the hooks a component file declares alongside it', () => {
    expect(byName('Toast').hooks.map((hook) => hook.name)).toEqual(['useToast']);
  });

  it('skips modules that do not export a component named after the file', () => {
    // organisms/table/core.tsx is shared by Table and VirtualTable.
    expect(manifest.components.map((entry) => entry.subpath)).not.toContain('organisms/table/core');
  });

  it('resolves variant unions declared behind an exported alias', () => {
    expect(byName('Button').variants).toEqual([
      {
        prop: 'variant',
        type: 'ButtonVariant',
        values: ['primary', 'accent', 'secondary', 'ghost'],
      },
      { prop: 'size', type: 'ButtonSize', values: ['sm', 'md', 'lg'] },
    ]);
  });

  it('resolves variant unions written inline in the props type', () => {
    expect(byName('Separator').variants).toEqual([
      { prop: 'orientation', type: null, values: ['horizontal', 'vertical'] },
    ]);
  });

  it('resolves numeric literal unions', () => {
    expect(byName('Accordion').variants).toEqual([
      { prop: 'headingLevel', type: 'AccordionHeadingLevel', values: [1, 2, 3, 4, 5, 6] },
    ]);
  });

  it('lists every value a compound component exports', () => {
    expect(byName('Card').exports).toEqual([
      'Card',
      'CardHeader',
      'CardTitle',
      'CardDescription',
      'CardContent',
      'CardFooter',
    ]);
  });

  it('lists hooks with their import specifiers and descriptions', () => {
    const hook = manifest.hooks.find((entry) => entry.name === 'useClickOutside');
    expect(hook).toMatchObject({
      importSpecifier: '@elirobinson/react/hooks/useClickOutside',
      importPath: '@elirobinson/react/hooks/useClickOutside',
      exports: ['useClickOutside'],
    });
    expect(hook.description.length).toBeGreaterThan(0);
  });

  it('excludes test files', () => {
    const paths = manifest.components.map((entry) => entry.subpath);
    expect(paths.some((path) => path.includes('.test'))).toBe(false);
  });
});

describe('layout-agnosticism', () => {
  const button = `
    export type ButtonVariant = 'primary' | 'ghost';
    export type ButtonProps = { variant?: ButtonVariant };
    export const Button = (props: ButtonProps) => null;
  `;

  it('reports tier null for a flat components directory', () => {
    const manifest = buildManifest(fixture({ 'src/components/Button.tsx': button }));

    expect(manifest.tiers).toEqual([]);
    expect(manifest.components).toEqual([
      expect.objectContaining({
        name: 'Button',
        tier: null,
        subpath: 'Button',
        importSpecifier: '@elirobinson/react/components/Button',
        variants: [{ prop: 'variant', type: 'ButtonVariant', values: ['primary', 'ghost'] }],
      }),
    ]);
  });

  it('reports whatever tier names a nested layout uses', () => {
    const manifest = buildManifest(fixture({ 'src/components/primitives/Button.tsx': button }));

    expect(manifest.tiers).toEqual(['primitives']);
    expect(manifest.components[0]).toMatchObject({
      tier: 'primitives',
      subpath: 'primitives/Button',
      importSpecifier: '@elirobinson/react/components/primitives/Button',
    });
  });

  it('degrades to an empty manifest when there is nothing to describe', () => {
    const manifest = buildManifest(fixture({}));

    expect(manifest).toMatchObject({ components: [], hooks: [], tiers: [] });
  });
});

describe('props-type resolution', () => {
  it('reads through an intersection with an external type', () => {
    const manifest = buildManifest(
      fixture({
        'src/components/atoms/Chip.tsx': `
          import type { HTMLAttributes } from 'react';
          export type ChipProps = HTMLAttributes<HTMLDivElement> & { tone?: 'neutral' | 'accent' };
          export const Chip = (props: ChipProps) => null;
        `,
      }),
    );

    expect(manifest.components[0].variants).toEqual([
      { prop: 'tone', type: null, values: ['neutral', 'accent'] },
    ]);
  });

  it('follows an alias chain without looping on a self-reference', () => {
    const manifest = buildManifest(
      fixture({
        'src/components/atoms/Loop.tsx': `
          type Base = { size?: 'sm' | 'lg' };
          type Mid = Base;
          export type LoopProps = Mid;
          export const Loop = (props: LoopProps) => null;
        `,
      }),
    );

    expect(manifest.components[0].variants).toEqual([
      { prop: 'size', type: null, values: ['sm', 'lg'] },
    ]);
  });

  it('ignores props whose type is not a literal union', () => {
    const manifest = buildManifest(
      fixture({
        'src/components/atoms/Open.tsx': `
          export type OpenProps = { label: string; count?: number; onOpen?: () => void };
          export const Open = (props: OpenProps) => null;
        `,
      }),
    );

    expect(manifest.components[0].variants).toEqual([]);
  });

  it('names the base a props type extends, and only when it is a name', () => {
    const manifest = buildManifest(
      fixture({
        'src/components/atoms/Plain.tsx': `
          export type PlainProps = { label: string };
          export const Plain = (props: PlainProps) => null;
        `,
        'src/components/atoms/Wide.tsx': `
          import type { HTMLAttributes } from 'react';
          export type WideProps = HTMLAttributes<HTMLDivElement> & { label: string };
          export const Wide = (props: WideProps) => null;
        `,
      }),
    );

    expect(manifest.components.map((entry) => [entry.name, entry.inherits])).toEqual([
      ['Plain', null],
      ['Wide', 'HTMLAttributes<HTMLDivElement>'],
    ]);
  });
});

describe('what counts as a component', () => {
  it('skips a module that exports helpers rather than a component of its own name', () => {
    const manifest = buildManifest(
      fixture({
        'src/components/atoms/Button.tsx': `export const Button = () => null;`,
        'src/components/atoms/shared.ts': `export const ROW_HEIGHT = 44;`,
      }),
    );

    expect(manifest.components.map((entry) => entry.name)).toEqual(['Button']);
  });

  it('still describes a component the type layer cannot parse, and says so', () => {
    const manifest = buildManifest(
      fixture({
        'src/components/atoms/Widget.tsx': `
          export type WidgetProps = { tone?: 'quiet' | 'loud' };
          export const Widget = 'not-a-component';
        `,
      }),
    );

    expect(manifest.components[0]).toMatchObject({
      name: 'Widget',
      propsType: 'WidgetProps',
      variants: [{ prop: 'tone', type: null, values: ['quiet', 'loud'] }],
      props: [],
      extractionGaps: expect.arrayContaining([
        'react-docgen-typescript found no component named after this file',
      ]),
    });
  });
});
