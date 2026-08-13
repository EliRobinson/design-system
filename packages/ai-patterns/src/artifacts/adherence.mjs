/* The oxlint config a Claude Design project enforces while an agent writes code
 * against this system — generated from `@elirobinson/react/manifest`, never
 * hand-written.
 *
 * Why generated: the config asserts a component's prop surface. Hand-maintained,
 * it is prose about the API, and prose about the API goes stale the moment a
 * prop moves. The copy this replaced had drifted badly — it described `Tooltip`
 * as taking `content` and `side`, put `Sheet`'s `side` on `Sheet` instead of
 * `SheetContent`, exported a `ToastViewport` that does not exist, and invented
 * seven child parts (`TableColumn`, `SelectOption`, `TabItem`, …). Every one of
 * those steered an agent toward code that cannot compile.
 *
 * The single most important rule here is the *roster* rule: anything
 * PascalCase-and-not-exported is flagged. That is what catches an invented
 * component, which is the failure the drifted config was actively causing.
 *
 * What this deliberately does NOT do: emit a prop allowlist for every component.
 * 36 of the 44 components spread native HTML attributes onto their root element,
 * so `<Button data-testid>` and `<Card aria-label>` are legal and an allowlist
 * would flag them. Allowlists are emitted only for the closed prop surfaces —
 * the components whose manifest record has `inherits: null`.
 *
 * The `x-omelette` key is the Design System pane's contract, not ours. It stays
 * under that name and keeps its shape; only the values are ours to get right.
 */

/** JSX props that are React or DOM mechanics rather than component API. */
const ALWAYS_ALLOWED = ['key', 'ref', 'className', 'style', 'children'];

/** Kinds the Design System pane understands. `@kind` in tokens.css overrides. */
const KIND_BY_PREFIX = [
  ['--radius-', 'radius'],
  ['--shadow-', 'shadow'],
  ['--font-', 'font'],
  ['--fw-', 'font'],
  ['--lh-', 'font'],
  ['--tr-', 'font'],
  ['--space-', 'spacing'],
  ['--fs-', 'spacing'],
  ['--container-', 'spacing'],
];

const COLOR_VALUE = /^(#|oklch\(|rgb|hsl|color\()/i;
const LENGTH_VALUE = /^-?[\d.]+(px|rem|em|vw|vh|%)$/;

/**
 * A token's kind, preferring the `@kind` annotation already carried in
 * tokens.css so the classification lives next to the token rather than here.
 *
 * @param {{name: string, resolved: string, comment: string | null}} token
 */
export function tokenKind(token) {
  const annotated = token.comment?.match(/@kind\s+(\w+)/);
  if (annotated) return annotated[1];

  for (const [prefix, kind] of KIND_BY_PREFIX) {
    if (token.name.startsWith(prefix)) return kind;
  }
  if (COLOR_VALUE.test(token.resolved)) return 'color';
  if (LENGTH_VALUE.test(token.resolved)) return 'spacing';
  return 'other';
}

/* Escapes a literal for embedding in an esquery regex alternation. Values are
   coerced because a union can be numeric — Accordion's headingLevel is 1..6. */
const alternation = (values) =>
  values.map((v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

/**
 * Every JSX name the system actually exports — top-level components, their
 * sub-components, and nothing else. This is the roster the "unknown component"
 * rule negates against.
 *
 * @param {{components: Array<{exports: string[]}>}} manifest
 */
export function exportedNames(manifest) {
  const names = new Set();
  for (const component of manifest.components) {
    for (const name of component.exports) {
      // Hooks are exported alongside components (useToast) but are never JSX.
      if (!/^use[A-Z]/.test(name)) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * @param {object} input
 * @param {object} input.manifest  `@elirobinson/react/manifest`
 * @param {Array<{name: string, value: string, resolved: string, comment: string | null}>} input.tokens
 * @param {string[]} [input.fontFamilies]
 * @param {string[]} [input.projectOwned]  Components that exist only in the design
 *   project — the `ai/` tier has no upstream counterpart. They are legal to use
 *   there, so they join the roster; without this the roster rule flags the
 *   project's own components as unknown.
 */
export function buildAdherenceConfig({
  manifest,
  tokens,
  fontFamilies = ['Geist', 'JetBrains Mono'],
  projectOwned = [],
}) {
  if (!manifest?.components?.length) {
    throw new Error('buildAdherenceConfig: manifest describes no components.');
  }
  if (!tokens?.length) {
    throw new Error('buildAdherenceConfig: no tokens supplied.');
  }

  const roster = [...new Set([...exportedNames(manifest), ...projectOwned])].sort();
  const restrictedSyntax = [];

  /* 1. Raw design values. A literal cannot be re-pointed, so it silently stops
        responding to [data-theme="dark"] — the same rule
        @elirobinson/no-hardcoded-design-values enforces in the repo. */
  restrictedSyntax.push(
    {
      selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
      message: 'Raw hex color — use a design-system color token via var().',
    },
    {
      selector: 'Literal[value=/\\b\\d+px\\b/]',
      message: 'Raw px value — use a design-system spacing token via var().',
    },
    {
      selector: `Literal[value=/font-family\\s*:\\s*(?!['\\"]?(?:${alternation(fontFamilies)}))/i]`,
      message: `Font not provided by the design system. Available: ${fontFamilies.join(', ')}.`,
    },
  );

  /* 2. The roster rule. An invented component is the failure mode a drifted
        config produces, and it is invisible until compile time otherwise. */
  restrictedSyntax.push({
    selector: `JSXOpeningElement[name.name=/^[A-Z]/][name.name!=/^(?:${alternation(roster)})$/]`,
    message:
      'Not a component this design system exports. Run `pnpm ds` for the inventory, ' +
      'or `pnpm ds props <Name>` for one component.',
  });

  /* 3. Variant unions, straight off the manifest's literal-union extraction.
        The Literal is matched as a descendant, not a direct child: a numeric
        union is written `headingLevel={3}`, which nests the literal inside a
        JSXExpressionContainer, and `variant={'ghost'}` does the same for
        strings. A direct-child selector silently matches neither. */
  for (const component of manifest.components) {
    for (const variant of component.variants ?? []) {
      const numeric = variant.values.every((v) => typeof v === 'number');
      restrictedSyntax.push({
        selector:
          `JSXOpeningElement[name.name='${component.name}'] > ` +
          `JSXAttribute[name.name='${variant.prop}'] ` +
          `Literal[value!=/^(?:${alternation(variant.values)})$/]`,
        message: `<${component.name}> ${variant.prop} must be one of ${variant.values
          .map((v) => (numeric ? String(v) : `'${v}'`))
          .join(' | ')}.`,
      });
    }
  }

  /* 4. Prop allowlists — closed surfaces only. A component that spreads native
        HTML attributes has no closed prop set, and pretending otherwise flags
        legitimate aria-*, data-* and event props. */
  for (const component of manifest.components) {
    if (component.inherits) continue;
    const allowed = [...component.props.map((p) => p.name), ...ALWAYS_ALLOWED];
    restrictedSyntax.push({
      selector:
        `JSXOpeningElement[name.name='${component.name}'] > JSXAttribute > ` +
        `JSXIdentifier[name!=/^(?:${alternation([...new Set(allowed)])})$/]`,
      message:
        `<${component.name}> does not accept that prop — it declares a closed prop surface. ` +
        `Declared: ${component.props.map((p) => p.name).join(', ') || '(none)'}.`,
    });
  }

  const tokenNames = tokens.map((t) => t.name);
  const tokenKinds = Object.fromEntries(tokens.map((t) => [t.name, tokenKind(t)]));

  return {
    $comment:
      'Generated from @elirobinson/react/manifest by @elirobinson/ai-patterns ' +
      '(src/artifacts/adherence.mjs). Do not edit by hand — regenerate instead.',
    plugins: ['react', 'import'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['components/**', 'ui_kits/**', 'patterns/**'],
              message: "Import design-system components from 'index.js', not component internals.",
            },
          ],
        },
      ],
      'no-restricted-syntax': ['warn', ...restrictedSyntax],
    },
    overrides: [{ files: ['**/index.js'], rules: { 'no-restricted-imports': 'off' } }],
    'x-omelette': {
      generatedFrom: `${manifest.package}@${manifest.version}`,
      projectOwned: [...projectOwned].sort(),
      components: Object.fromEntries(roster.map((name) => [name, { replaces: [] }])),
      tokens: [...tokenNames].sort(),
      tokenKinds,
      fontFamilies,
    },
  };
}
