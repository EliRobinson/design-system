// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { buildManifest } from './manifest.mjs';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

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

  it('covers every tier and every component directory', () => {
    expect(manifest.tiers).toEqual(expect.arrayContaining(['atoms', 'molecules', 'organisms']));
    expect(manifest.components.length).toBeGreaterThan(40);
    expect(manifest.package).toBe('@elirobinson/react');
  });

  it('records the import specifier a consumer must type', () => {
    expect(byName('Button')).toMatchObject({
      tier: 'atoms',
      subpath: 'atoms/Button',
      importSpecifier: '@elirobinson/react/components/atoms/Button',
      propsType: 'ButtonProps',
    });
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

  it('lists hooks with their import specifiers', () => {
    const hook = manifest.hooks.find((entry) => entry.name === 'useClickOutside');
    expect(hook).toMatchObject({
      importSpecifier: '@elirobinson/react/hooks/useClickOutside',
      exports: ['useClickOutside'],
    });
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
});
