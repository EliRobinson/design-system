import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import contracts from '@elirobinson/ai-patterns/contracts';
import { describe, expect, it } from 'vitest';

import { TIERS, components, getComponent, hooks } from './manifest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const reactSrc = join(repoRoot, 'packages/react/src');

describe('component manifest', () => {
  it('covers all 44 components and 5 hooks', () => {
    expect(components).toHaveLength(44);
    expect(hooks).toHaveLength(5);
  });

  it('has unique slugs', () => {
    const slugs = components.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('only uses known tiers', () => {
    for (const c of components) {
      expect(TIERS).toContain(c.tier);
    }
  });

  it('has an import path that resolves to a real source file for every component', () => {
    for (const c of components) {
      const rel = c.importPath.replace('@elirobinson/react/', '');
      expect(existsSync(join(reactSrc, `${rel}.tsx`)), c.importPath).toBe(true);
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
      const rel = h.importPath.replace('@elirobinson/react/', '');
      expect(existsSync(join(reactSrc, `${rel}.ts`)), h.importPath).toBe(true);
    }
  });

  it('extracted a real component from every file', () => {
    for (const c of components) {
      expect(
        c.extractionGaps.some((g) => g.includes('found no components')),
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
