import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import contracts from '@elirobinson/ai-patterns/contracts';
import { describe, expect, it } from 'vitest';

import { TIERS, components, getComponent, hooks } from './manifest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const reactSrc = join(repoRoot, 'packages/react/src');
const docsSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('component manifest', () => {
  it('covers all 44 components and 7 hooks', () => {
    expect(components).toHaveLength(44);
    expect(hooks).toHaveLength(7);
  });

  it('has unique slugs', () => {
    const slugs = components.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('reports the tiers the package actually groups its components under', () => {
    expect(TIERS).toEqual(['atoms', 'molecules', 'organisms']);
  });

  it('gives every component a page and at least one demo on disk', () => {
    /* Checked against the filesystem, not the sidebar — the sidebar derives
       from this same manifest, so comparing the two could never fail. */
    for (const c of components) {
      expect(
        existsSync(join(docsSrc, 'app/(docs)/components', c.slug, 'page.mdx')),
        `${c.slug} has no page.mdx`,
      ).toBe(true);
      const demoDir = join(docsSrc, 'components/demos', c.slug);
      const demos = existsSync(demoDir) ? readdirSync(demoDir) : [];
      expect(demos.length, `${c.slug} has no demos`).toBeGreaterThan(0);
    }
  });

  it('has an import path that resolves to a real source file for every component', () => {
    for (const c of components) {
      const rel = c.importSpecifier.replace('@elirobinson/react/', '');
      expect(existsSync(join(reactSrc, `${rel}.tsx`)), c.importSpecifier).toBe(true);
    }
  });

  it('has stylesheet paths that resolve to real files', () => {
    for (const c of components) {
      for (const sheet of c.stylesheetPaths) {
        const rel = sheet.replace('@elirobinson/react/styles/', 'components/');
        expect(existsSync(join(reactSrc, rel)), sheet).toBe(true);
      }
    }
  });

  it('has hook import paths that resolve to real source files', () => {
    for (const h of hooks) {
      const rel = h.importSpecifier.replace('@elirobinson/react/', '');
      expect(existsSync(join(reactSrc, `${rel}.ts`)), h.importSpecifier).toBe(true);
    }
  });

  it('extracted a real component from every file', () => {
    for (const c of components) {
      expect(
        c.extractionGaps.some((g) => g.includes('found no component')),
        `${c.name}: ${c.extractionGaps.join('; ')}`,
      ).toBe(false);
    }
  });

  it('carries a one-line description for every component', () => {
    for (const c of components) {
      expect(c.description.length, c.name).toBeGreaterThan(0);
    }
  });

  it('only references constraints defined in @elirobinson/ai-patterns contracts', () => {
    const known = Object.keys(contracts.componentConstraints);
    for (const c of components) {
      for (const id of c.constraints) {
        expect(known, `${c.name} → ${id}`).toContain(id);
      }
    }
  });

  it('extracts the real prop surface for Button', () => {
    const button = getComponent('button');
    expect(button).toBeDefined();
    const variant = button?.props.find((p) => p.name === 'variant');
    expect(variant?.type).toBe('"primary" | "accent" | "secondary" | "ghost"');
    expect(variant?.defaultValue).toBe('primary');
    expect(button?.constraints).toContain('touch-target-primary');
    expect(button?.inherits).toBe('ButtonHTMLAttributes<HTMLButtonElement>');
  });

  it('groups compound sub-components under their primary component', () => {
    const card = getComponent('card');
    expect(card?.subComponents.map((s) => s.name)).toEqual(
      expect.arrayContaining(['CardHeader', 'CardTitle', 'CardContent', 'CardFooter']),
    );
  });
});
