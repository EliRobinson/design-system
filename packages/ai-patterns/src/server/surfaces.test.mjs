// The three structured surfaces are the one place this package states another
// package's prop names. That is a copy, and a copy rots: a prop renamed in
// @elirobinson/react leaves a schema here that still validates, still streams,
// and produces props the component silently ignores.
//
// So the copy is checked against the original. The manifest — the same artifact
// `ds` and the MCP server read — is resolved through the exports map rather than
// by path, so this suite reads exactly what a consumer would, and Nx orders
// react's build before this test (`test` dependsOn `^build` in nx.json).
//
// Exclusions are listed rather than inferred, in the shape the dependency
// boundary suite uses for its permitted imports: a prop is left out of a schema
// for a stated reason, and the reason has to stay true — an exclusion naming a
// prop that no longer exists fails here rather than sitting in the file as a
// carve-out nobody can evaluate.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import {
  decisionCardSchema,
  decisionCardSurface,
  renderDecisionCard,
} from './surfaces/decision-card.mjs';
import { renderStubCard, stubCardSchema, stubCardSurface } from './surfaces/stub-card.mjs';
import {
  renderVerdictBadge,
  verdictBadgeSchema,
  verdictBadgeSurface,
} from './surfaces/verdict-badge.mjs';

const require = createRequire(import.meta.url);

function componentManifest() {
  try {
    return JSON.parse(readFileSync(require.resolve('@elirobinson/react/manifest'), 'utf8'));
  } catch (error) {
    throw new Error(
      'Cannot resolve @elirobinson/react/manifest. Build that package first: pnpm nx build react.',
      { cause: error },
    );
  }
}

const components = new Map(componentManifest().components.map((entry) => [entry.name, entry]));

/* A model cannot author a ReactNode, and it has no view of the page's heading
   outline. Both exclusions are the schema refusing to pretend otherwise. */
const EXCLUDED = [
  {
    component: 'DecisionCard',
    prop: 'action',
    reason: 'a ReactNode — a generated action is a generated destination',
  },
  {
    component: 'DecisionCard',
    prop: 'headingLevel',
    reason: "the page's outline, which the model cannot see; the component defaults it to 2",
  },
  {
    component: 'VerdictBadge',
    prop: 'glyph',
    reason: 'a ReactNode, and the default marks are not copy a product has to own',
  },
];

const SURFACES = [
  {
    name: 'DecisionCard',
    surface: decisionCardSurface,
    schema: decisionCardSchema,
    render: renderDecisionCard,
    kind: 'decision-card',
    valid: {
      verdict: 'go',
      verdictLabel: 'Go',
      headline: 'The migration pays for itself in four months.',
      figures: [{ label: 'One-off cost', value: '£18,400' }],
      total: { label: 'Total', value: '£18,400' },
      closing: 'Start with the read path.',
    },
    invalid: { verdict: 'maybe', verdictLabel: 'Maybe', headline: 'Unclear.' },
  },
  {
    name: 'VerdictBadge',
    surface: verdictBadgeSurface,
    schema: verdictBadgeSchema,
    render: renderVerdictBadge,
    kind: 'verdict-badge',
    valid: { verdict: 'hold', label: 'Hold' },
    invalid: { verdict: 'hold', label: '' },
  },
  {
    name: 'StubCard',
    surface: stubCardSurface,
    schema: stubCardSchema,
    render: renderStubCard,
    kind: 'stub-card',
    valid: {
      title: 'Migration estimate',
      items: [{ label: 'Read path', value: 'Four weeks' }],
      stubLabel: 'Total',
      stubValue: 'Nine weeks',
    },
    /* A `<dl>` with no rows renders without error and reads as a bug, which is
       the failure mode a schema is for. */
    invalid: {
      title: 'Migration estimate',
      items: [],
      stubLabel: 'Total',
      stubValue: 'Nine weeks',
    },
  },
];

describe('the manifest this suite checks against', () => {
  it('describes the three components these surfaces target', () => {
    expect([...components.keys()]).toEqual(
      expect.arrayContaining(SURFACES.map(({ name }) => name)),
    );
  });
});

describe.each(SURFACES)('$name', ({ name, surface, schema, render, kind, valid, invalid }) => {
  const record = components.get(name);
  /* Every key the schema declares, optional ones included — `parse` would only
     report the keys the sample happens to set. */
  const declared = new Set(Object.keys(schema.shape));
  const excluded = new Set(
    EXCLUDED.filter((entry) => entry.component === name).map((entry) => entry.prop),
  );

  it('names no prop the component does not have', () => {
    const componentProps = new Set(record.props.map((prop) => prop.name));
    const invented = [...declared].filter((key) => !componentProps.has(key));

    expect(
      invented,
      `${name}'s schema declares ${invented.join(', ')}, which ${name} does not accept — ` +
        'the props would be spread onto the DOM and ignored',
    ).toEqual([]);
  });

  it('covers every prop the component requires', () => {
    const missing = record.props
      .filter((prop) => prop.required)
      .map((prop) => prop.name)
      .filter((propName) => !declared.has(propName) && !excluded.has(propName));

    expect(
      missing,
      `${name} requires ${missing.join(', ')}, and the schema cannot produce it — ` +
        'a model that follows the schema still renders a broken card',
    ).toEqual([]);
  });

  it('renders straight into props, with no mapping and no stray keys', () => {
    const rendered = render(valid);

    expect(rendered.kind).toBe(kind);
    expect(rendered.component).toBe(name);
    expect(rendered.props).toEqual(valid);
    /* `kind` lives beside `props`, not in them: these components spread their
       rest props onto a DOM element, so a dispatch key mixed in would land in
       the markup as an unknown attribute. */
    expect(Object.keys(rendered.props)).not.toContain('kind');
  });

  it('refuses model output that does not satisfy the contract', () => {
    expect(() => render(invalid)).toThrow();
  });

  it('carries its schema and its renderer together', () => {
    expect(surface.schema).toBe(schema);
    expect(surface.render).toBe(render);
    expect(surface.component).toBe(name);
    expect(surface.kind).toBe(kind);
  });
});

describe('the exclusion list', () => {
  it.each(EXCLUDED)('$component.$prop is still a prop worth excluding', ({ component, prop }) => {
    const names = components.get(component).props.map((entry) => entry.name);

    expect(
      names,
      `${component} no longer has a ${prop} prop — delete the exclusion rather than ` +
        'leaving it to describe a component that has moved on',
    ).toContain(prop);
  });
});
