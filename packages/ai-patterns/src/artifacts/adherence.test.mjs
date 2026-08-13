/* The adherence generator, tested against a fixture manifest shaped like
 * @elirobinson/react/manifest.
 *
 * The cases that matter are the ones the hand-written config it replaced got
 * wrong: an invented component name, a prop allowlist applied to a component
 * that spreads HTML attributes, and a variant union copied by hand.
 */

import { describe, expect, it } from 'vitest';

import { buildAdherenceConfig, exportedNames, tokenKind } from './adherence.mjs';

const manifest = {
  package: '@elirobinson/react',
  version: '1.1.0',
  tiers: ['atoms', 'organisms'],
  components: [
    {
      name: 'Button',
      tier: 'atoms',
      inherits: 'ButtonHTMLAttributes<HTMLButtonElement>',
      exports: ['Button'],
      variants: [{ prop: 'variant', type: 'ButtonVariant', values: ['primary', 'ghost'] }],
      props: [{ name: 'variant', type: '"primary" | "ghost"', required: false }],
      subComponents: [],
    },
    {
      name: 'Tooltip',
      tier: 'organisms',
      inherits: null,
      exports: ['Tooltip', 'TooltipTrigger', 'TooltipContent'],
      variants: [],
      props: [{ name: 'delayDuration', type: 'number', required: false }],
      subComponents: [{ name: 'TooltipContent', inherits: 'HTMLAttributes<HTMLDivElement>' }],
    },
    {
      name: 'Toast',
      tier: 'organisms',
      inherits: 'HTMLAttributes<HTMLDivElement>',
      exports: ['Toaster', 'useToast', 'Toast'],
      variants: [],
      props: [],
      subComponents: [],
    },
    {
      name: 'Accordion',
      tier: 'organisms',
      inherits: 'HTMLAttributes<HTMLDivElement>',
      exports: ['Accordion'],
      // A numeric union — written `headingLevel={3}`, not `headingLevel="3"`.
      variants: [{ prop: 'headingLevel', type: 'HeadingLevel', values: [1, 2, 3] }],
      props: [],
      subComponents: [],
    },
  ],
};

const tokens = [
  {
    name: '--ink-500',
    value: 'oklch(55% 0.008 247)',
    resolved: 'oklch(55% 0.008 247)',
    comment: null,
  },
  { name: '--fg', value: 'var(--ink-1000)', resolved: '#000000', comment: null },
  { name: '--space-4', value: '16px', resolved: '16px', comment: null },
  { name: '--radius-sm', value: '4px', resolved: '4px', comment: 'default for inputs' },
  { name: '--lh-tight', value: '1.05', resolved: '1.05', comment: '@kind font' },
  { name: '--dur-fast', value: '140ms', resolved: '140ms', comment: '@kind other' },
];

const build = () => buildAdherenceConfig({ manifest, tokens });
const syntaxRules = () => build().rules['no-restricted-syntax'].slice(1);
const ruleMatching = (fragment) => syntaxRules().find((rule) => rule.selector.includes(fragment));

describe('exportedNames', () => {
  it('collects components and sub-components', () => {
    expect(exportedNames(manifest)).toContain('TooltipContent');
    expect(exportedNames(manifest)).toContain('Toaster');
  });

  it('drops hooks, which are never JSX', () => {
    expect(exportedNames(manifest)).not.toContain('useToast');
  });
});

describe('tokenKind', () => {
  it('prefers the @kind annotation in tokens.css', () => {
    expect(tokenKind(tokens[4])).toBe('font');
    expect(tokenKind(tokens[5])).toBe('other');
  });

  it('classifies by prefix, then by resolved value', () => {
    expect(tokenKind(tokens[0])).toBe('color');
    expect(tokenKind(tokens[2])).toBe('spacing');
    expect(tokenKind(tokens[3])).toBe('radius');
  });

  it('follows var() chains to classify an alias', () => {
    expect(tokenKind(tokens[1])).toBe('color');
  });
});

describe('the roster rule', () => {
  it('admits every exported name', () => {
    const { selector } = ruleMatching('name.name!=');
    for (const name of ['Button', 'Tooltip', 'TooltipTrigger', 'Toaster']) {
      expect(selector).toContain(name);
    }
  });

  it('admits project-owned components that have no upstream counterpart', () => {
    // The design project's ai/ tier is its own; flagging it would make the
    // rule fire on the project's own components.
    const cfg = buildAdherenceConfig({ manifest, tokens, projectOwned: ['ChatThread'] });
    const rule = cfg.rules['no-restricted-syntax'].find((r) => r.selector?.includes('name.name!='));
    expect(rule.selector).toContain('ChatThread');
    expect(cfg['x-omelette'].projectOwned).toEqual(['ChatThread']);
    expect(cfg['x-omelette'].components).toHaveProperty('ChatThread');
  });

  it('would flag a name the system does not export', () => {
    const { selector } = ruleMatching('name.name!=');
    // The negated alternation is what makes an invented part fail.
    expect(selector).not.toMatch(/\bToastViewport\b/);
    expect(selector).not.toMatch(/\bTableColumn\b/);
  });
});

describe('variant rules', () => {
  it('emits the union straight off the manifest', () => {
    const rule = ruleMatching("JSXAttribute[name.name='variant']");
    expect(rule.selector).toContain('primary|ghost');
    expect(rule.message).toBe("<Button> variant must be one of 'primary' | 'ghost'.");
  });

  it('handles a numeric union without crashing on String.replace', () => {
    const rule = ruleMatching("JSXAttribute[name.name='headingLevel']");
    expect(rule.selector).toContain('1|2|3');
  });

  it('quotes string values but not numeric ones', () => {
    expect(ruleMatching("JSXAttribute[name.name='headingLevel']").message).toBe(
      '<Accordion> headingLevel must be one of 1 | 2 | 3.',
    );
  });

  it('matches the literal as a descendant, so `prop={x}` is covered', () => {
    // `headingLevel={3}` nests the Literal inside a JSXExpressionContainer; a
    // `> Literal` direct-child selector would match nothing at all.
    const rule = ruleMatching("JSXAttribute[name.name='headingLevel']");
    expect(rule.selector).not.toContain("[name.name='headingLevel'] > Literal");
    expect(rule.selector).toContain("[name.name='headingLevel'] Literal");
  });
});

describe('prop allowlists', () => {
  it('are emitted for a closed prop surface', () => {
    const rule = ruleMatching("JSXOpeningElement[name.name='Tooltip'] > JSXAttribute >");
    expect(rule.selector).toContain('delayDuration');
    expect(rule.message).toContain('closed prop surface');
  });

  it('are NOT emitted for a component that spreads HTML attributes', () => {
    // This is the bug in the config this replaces: allowlisting <Button> flags
    // legitimate props like data-testid, aria-label and onClick.
    expect(ruleMatching("JSXOpeningElement[name.name='Button'] > JSXAttribute >")).toBeUndefined();
    expect(ruleMatching("JSXOpeningElement[name.name='Toast'] > JSXAttribute >")).toBeUndefined();
  });

  it('always permits React and DOM mechanics', () => {
    const rule = ruleMatching("JSXOpeningElement[name.name='Tooltip'] > JSXAttribute >");
    for (const prop of ['key', 'ref', 'className', 'style', 'children']) {
      expect(rule.selector).toContain(prop);
    }
  });
});

describe('the emitted config', () => {
  it('stamps what it was generated from', () => {
    expect(build()['x-omelette'].generatedFrom).toBe('@elirobinson/react@1.1.0');
    expect(build().$comment).toContain('Do not edit by hand');
  });

  it('carries every token and its kind', () => {
    const omelette = build()['x-omelette'];
    expect(omelette.tokens).toContain('--ink-500');
    expect(omelette.tokens).toEqual([...omelette.tokens].sort());
    expect(omelette.tokenKinds['--radius-sm']).toBe('radius');
  });

  it('refuses to generate from an empty manifest', () => {
    expect(() => buildAdherenceConfig({ manifest: { components: [] }, tokens })).toThrow(
      /describes no components/,
    );
  });

  it('refuses to generate without tokens', () => {
    expect(() => buildAdherenceConfig({ manifest, tokens: [] })).toThrow(/no tokens/);
  });
});

describe('a stale manifest', () => {
  /* The record shape an older dist/manifest.json in this repo actually had,
     before the extractor emitted `props` — note `propsType` but no `props`. */
  const stale = {
    package: '@elirobinson/react',
    version: '0.9.0',
    components: [
      {
        name: 'Button',
        tier: 'atoms',
        subpath: 'atoms/Button',
        importSpecifier: '@elirobinson/react/components/atoms/Button',
        exports: ['Button'],
        types: ['ButtonProps'],
        propsType: 'ButtonProps',
        variants: [{ prop: 'variant', type: 'ButtonVariant', values: ['primary', 'ghost'] }],
      },
    ],
  };

  it('is rejected at entry, not by a TypeError deep in a loop', () => {
    // It used to reach `component.props.map` and throw
    // "Cannot read properties of undefined (reading 'map')".
    expect(() => buildAdherenceConfig({ manifest: stale, tokens })).not.toThrow(TypeError);
    expect(() => buildAdherenceConfig({ manifest: stale, tokens })).toThrow(
      /missing props, inherits/,
    );
  });

  it('names the record and the rebuild that fixes it', () => {
    expect(() => buildAdherenceConfig({ manifest: stale, tokens })).toThrow(/<Button>/);
    expect(() => buildAdherenceConfig({ manifest: stale, tokens })).toThrow(
      /stale — rebuild it with `pnpm nx build react`/,
    );
  });

  it('no longer tolerates a missing variants key either', () => {
    // `variants` was the field with a `?? []`, so a manifest predating it failed
    // silently — a config with no variant rules at all, and nothing to say so.
    const noVariants = {
      ...manifest,
      components: manifest.components.map((component) => {
        const record = { ...component };
        delete record.variants;
        return record;
      }),
    };
    expect(() => buildAdherenceConfig({ manifest: noVariants, tokens })).toThrow(
      /missing variants/,
    );
  });

  it('locates an unnamed record by index', () => {
    const nameless = { ...manifest, components: [{ exports: ['X'] }] };
    expect(() => buildAdherenceConfig({ manifest: nameless, tokens })).toThrow(/at index 0/);
  });

  it('accepts inherits: null, which is a closed prop surface and not an absent field', () => {
    // The fixture's <Tooltip> declares `inherits: null`; requiring the key to be
    // non-null would reject the very records that earn a prop allowlist.
    expect(() => build()).not.toThrow();
    expect(ruleMatching("JSXOpeningElement[name.name='Tooltip'] > JSXAttribute >")).toBeDefined();
  });
});
