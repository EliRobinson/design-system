/* The design system as a query surface for an agent while it writes code —
 * the same question the `elirobinson-ds` CLI answers ("what does the version
 * I have installed offer?"), exposed over MCP at the moment the answer
 * matters. Everything reads the installed packages (see environment.mjs) and
 * never the network, so it cannot go stale.
 *
 * Design rules this file follows, from the docs-site-sync spec:
 *
 * - Few, sharply-bounded tools: every tool's name, description, and schema
 *   enters the model's context on every request. `get_component` returns
 *   props, variants, sub-components, AND constraints in one call — every
 *   unresolved identifier returned is a round trip forced on the agent.
 * - Error text is a model-facing API. A failure enumerates the valid
 *   alternatives ("No token X. Prefixes: …"), because that is what lets the
 *   model retry; "Not found" does not. Failures are `isError: true` results,
 *   never protocol errors.
 * - Brand voice and the constraint set are also mirrored as resources, for a
 *   human pulling them into a review conversation — in Claude Code a
 *   resource is inert unless a human `@`-mentions it, which is exactly why
 *   every primary surface here is a tool. `get_dials` has deliberately NO
 *   resource mirror: the reader who must stop assuming a single combination
 *   is the model, not the human reviewing afterwards, and a resource is the
 *   one surface a model never sees unaided. A mirror would add a listing
 *   entry, a URI, and a second copy of the rendering for an audience that is
 *   already served by `get_dials` and `search_tokens`.
 */

import { readFileSync } from 'node:fs';

import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import {
  adherenceConfig,
  brandManifest,
  brandVoiceRules,
  componentManifest,
  contracts,
  designDials,
  designTokens,
} from './environment.mjs';

const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const text = (value) => ({ content: [{ type: 'text', text: value }] });
const failure = (value) => ({ content: [{ type: 'text', text: value }], isError: true });

/* ------------------------------------------------------------------ tools */

function componentNames() {
  return componentManifest().components.map((c) => c.name);
}

function findComponent(name) {
  const wanted = name.toLowerCase();
  return componentManifest().components.find(
    (c) => c.name.toLowerCase() === wanted || c.slug === wanted,
  );
}

function propsTable(props) {
  if (!props || props.length === 0) {
    return '(no props of its own beyond inherited HTML attributes)';
  }
  return [
    '| Prop | Type | Required | Default | Description |',
    '| --- | --- | --- | --- | --- |',
    ...props.map(
      (prop) =>
        `| ${prop.name} | \`${prop.type.replace(/\|/g, '\\|')}\` | ${prop.required ? 'yes' : 'no'} | ${
          prop.defaultValue ?? '—'
        } | ${prop.description || '—'} |`,
    ),
  ].join('\n');
}

function renderComponent(component) {
  const { componentConstraints = {} } = contracts();
  const exported = [
    component.name,
    ...component.subComponents.map((sub) => sub.name),
    ...component.hooks.map((hook) => hook.name),
  ].join(', ');

  const parts = [
    `# ${component.name} (${component.tier})`,
    '',
    component.description,
    '',
    `Import: \`import { ${exported} } from '${component.importSpecifier}';\``,
  ];
  if (component.stylesheetPaths.length > 0) {
    parts.push(`Styles: ${component.stylesheetPaths.join(', ')} (included in styles.css)`);
  }
  if (component.inherits) {
    parts.push(`Also accepts all \`${component.inherits}\` props.`);
  }
  parts.push('', propsTable(component.props));
  for (const sub of component.subComponents) {
    parts.push('', `## ${sub.name}`, '', propsTable(sub.props));
    if (sub.inherits) {
      parts.push(`Also accepts all \`${sub.inherits}\` props.`);
    }
  }
  if (component.constraints.length > 0) {
    parts.push('', '## Constraints');
    for (const id of component.constraints) {
      const entry = componentConstraints[id];
      parts.push(entry ? `- **${id}** — ${entry.summary} Check: ${entry.check}` : `- **${id}**`);
    }
  }
  return parts.join('\n');
}

/* A token's family — the first segment of its name, `--target` for
   `--target-min` and for `--target` itself.

   This used to be `/^--[a-z]+-/`, which required a TRAILING HYPHEN and so
   matched nothing at all for the two families that are a bare name: `--scrim`
   and `--target`. They were dropped from the `Prefixes: …` list a failed
   search is built from, which made them a dead end — the model was told every
   family the system has *except* the one it was looking for, and nothing in
   the answer suggested searching by query instead. */
const familyOf = (name) => name.match(/^--[a-z0-9]+/)?.[0] ?? name;

/**
 * Every token family, spelled the way `search_tokens` accepts it back.
 *
 * A family whose members all carry a suffix is printed with the trailing
 * hyphen it has always been printed with (`--ink-`); a family that is also a
 * token in its own right is printed bare (`--target`), because `--target-`
 * would name something the system does not have. Either spelling is accepted
 * on the way back in, so the distinction costs the model nothing.
 */
function tokenPrefixes(tokens) {
  const names = new Set(tokens.map((token) => token.name));
  const families = [...new Set(tokens.map((token) => familyOf(token.name)))];
  return families.map((family) => (names.has(family) ? family : `${family}-`));
}

/* ------------------------------------------------------------- the dials */

/* Everything below reads the roster out of `@elirobinson/tokens/dials` and
   never restates it. A third palette must widen this server on a version bump
   with no edit here — a hard-coded "ember and slate" is the exact bug these
   two surfaces exist to close, and it is a bug that never fails, it just
   quietly answers for a fraction of the system. */

/** `[data-platform='mobile']` — the selector that turns an override on. */
function platformSelector(dials, platform) {
  const attribute = dials.dialNamed('platform')?.attribute;
  return attribute ? `[${attribute}='${platform}']` : platform;
}

/**
 * One token's values, by the printing rule every surface in this change
 * shares: a token that does not vary prints ONE value with no combination
 * label, and a token that varies prints one labelled value per combination in
 * COMBINATIONS order. Platform overrides are appended in both cases.
 *
 * `token` is the parsed declaration (declared value, resolved value, comment)
 * and `entry` is the same token across the dials. A varying token deliberately
 * does not print its declared value as a bare value — that value is the
 * default combination's and nothing else, and printing it unlabelled beside
 * the labelled ones is the confusion this whole tool exists to remove. Only an
 * alias (`var(--accent-fg)`) survives, because an alias is the same in every
 * combination and says something the resolved values do not.
 */
function renderToken(dials, token, entry) {
  const comment = token.comment ? ` — ${token.comment}` : '';
  const lines = [];

  if (!entry || !entry.varies) {
    lines.push(
      `${token.name}: ${token.value}` +
        (token.resolved !== token.value ? ` (resolves to ${token.resolved})` : '') +
        comment,
    );
  } else {
    const alias = token.value.includes('var(') ? `${token.value}, ` : '';
    lines.push(`${token.name}: ${alias}varies by combination${comment}`);
    for (const value of entry.values) {
      lines.push(`    ${value.combination}: ${value.value ?? '(not declared)'}`);
    }
  }

  for (const override of entry?.platforms ?? []) {
    lines.push(
      `    ${override.platform} ${platformSelector(dials, override.platform)}: ${override.value}`,
    );
  }
  return lines.join('\n');
}

/** The dial roster, the combinations, and the platform overrides, as markdown. */
function renderDials({ dials, entries, ownership }) {
  const { COMBINATIONS, DEFAULT_PLATFORM, DIALS, PLATFORMS } = dials;
  const parts = [
    '# The three dials',
    '',
    'Every token in this system resolves under three INDEPENDENT attributes on the root ' +
      'element. A token value is only meaningful inside one combination of them, and you must ' +
      'not assume one: the same token name is a different colour in every palette and every ' +
      'theme, and a different length on every platform.',
    '',
    `With no attributes set at all a root element renders ${dials.defaultCombinationId()} on ` +
      `${DEFAULT_PLATFORM} — that is the default, and it is one of ${COMBINATIONS.length} ` +
      `colour combinations, not the system.`,
  ];

  for (const dial of DIALS) {
    const owned = ownership[dial.name] ?? [];
    parts.push(
      '',
      `## ${dial.name} — \`${dial.attribute}\``,
      '',
      `Values: ${dial.values
        .map((value) => (value === dial.default ? `${value} (default)` : value))
        .join(', ')}`,
      `Owns: ${dial.owns}`,
      owned.length > 0
        ? `Moves ${owned.length} token(s): ${owned.join(', ')}`
        : 'Moves no token in the installed stylesheets.',
    );
  }

  parts.push(
    '',
    '## Combinations',
    '',
    'Palette and theme together make a COMBINATION, written `<palette>/<theme>`. That exact ' +
      'spelling is the id `search_tokens` labels every varying value with — never abbreviated, ' +
      'reordered, or written with any other separator. Set a combination by putting these ' +
      'attributes on the root element; a dial left at its default takes no attribute, because ' +
      'an absent attribute already means the default.',
    '',
    '| Combination | Root attributes |',
    '| --- | --- |',
    ...COMBINATIONS.map((combination) => {
      const attributes = dials.dialAttributeString({
        palette: combination.palette,
        theme: combination.theme,
      });
      const id =
        combination.id === dials.defaultCombinationId()
          ? `${combination.id} (default)`
          : combination.id;
      return `| ${id} | ${attributes || '(none — the default)'} |`;
    }),
  );

  /* The platform is a THIRD, ORTHOGONAL axis and is never folded into a
     combination id. The platform layer deliberately declares no colour — every
     measured contrast ratio in this system depends on that — so it cannot
     change what a combination resolves to. Folding it in would print
     2 × COMBINATIONS.length columns of which half are exact duplicates, and
     bury the dozen tokens that actually move. So an override is reported ON TOP
     of the combinations, labelled with its platform name and its selector. */
  parts.push(
    '',
    '## Platform overrides',
    '',
    'The platform is a third, orthogonal axis and is never part of a combination id. The ' +
      'platform layer declares no colour at all — every measured contrast ratio in the system ' +
      'depends on that — so it re-points geometry and the small end of the type ramp only, and ' +
      'it does so identically in every combination. A platform-varying token is therefore ' +
      'reported as an override on top of the combinations, labelled with its platform and its ' +
      'selector.',
  );

  for (const platform of PLATFORMS) {
    if (platform === DEFAULT_PLATFORM) continue;
    const overrides = entries
      .flatMap((entry) =>
        entry.platforms
          .filter((override) => override.platform === platform)
          .map((override) => `- ${entry.name}: ${override.value}`),
      )
      .sort();
    parts.push(
      '',
      `### ${platform} — \`${platformSelector(dials, platform)}\``,
      '',
      overrides.length > 0
        ? `Re-points ${overrides.length} token(s); everything else inherits its combination value.`
        : 'Re-points no token in the installed stylesheets.',
      ...overrides,
    );
  }

  return parts.join('\n');
}

/** The shipped, renderable UI kits from the brand manifest. */
function shippedKits() {
  return brandManifest().artifacts.filter(
    (artifact) => artifact.category === 'ui-kit' && artifact.ships,
  );
}

const kitSlug = (kit) => kit.id.split('/').pop();

/* ---------------------------------------------------------------- factory */

/**
 * The server factory. `serveStdio` takes it, and the in-process test harness
 * drives the same factory — export it, never an instance.
 */
export function createServer() {
  const server = new McpServer({ name: 'miltinson-design-system', version: VERSION });

  server.registerTool(
    'get_component',
    {
      title: 'Get a component',
      description:
        'One component of the installed @elirobinson/react: exact import line, full prop ' +
        'tables (component and sub-components), hooks, stylesheets, and its applicable ' +
        'design-system constraints — all in one call.',
      inputSchema: z.object({
        name: z.string().describe('Component name ("Button") or slug ("date-picker")'),
      }),
    },
    async ({ name }) => {
      const component = findComponent(name);
      if (!component) {
        return failure(`No component "${name}". Components: ${componentNames().join(', ')}.`);
      }
      return text(renderComponent(component));
    },
  );

  server.registerTool(
    'get_dials',
    {
      title: 'Get the three dials',
      description:
        'The three independent root-element attributes the installed @elirobinson/tokens ' +
        "resolves under — palette, theme, and platform — with each dial's attribute, values, " +
        'default, and the tokens it moves; every palette/theme combination with the attributes ' +
        'that select it; and the platform overrides. A token value is only meaningful inside ' +
        'ONE combination, and you must not assume one: read this before quoting any colour, ' +
        "radius, or type value as if it were the system's only value.",
      inputSchema: z.object({}),
    },
    async () => text(renderDials(await designDials())),
  );

  server.registerTool(
    'search_tokens',
    {
      title: 'Search design tokens',
      description:
        'Design tokens of the installed @elirobinson/tokens, read through every token ' +
        'stylesheet the package declares — not tokens.css alone, which omits the whole brand ' +
        'layer. Returns name, declared value, resolved value, comment, and the value in each ' +
        'palette/theme combination plus any platform override. Filter by prefix ("ink", ' +
        '"--space-", "scrim") or a substring of the name or comment.',
      inputSchema: z.object({
        query: z.string().optional().describe('Substring of the token name or its comment'),
        prefix: z
          .string()
          .optional()
          .describe('Token family, e.g. "ink", "--space-", or a bare family like "scrim"'),
        limit: z.number().int().positive().max(200).default(20),
      }),
    },
    async ({ query, prefix, limit }) => {
      const tokens = await designTokens();
      let matches = tokens;
      if (prefix) {
        /* A prefix names a FAMILY, and a family may be a token in its own
           right. Normalising to `--target-` and matching on startsWith — what
           this did — returned --target-min and --target-lg but never --target,
           and returned nothing whatsoever for --scrim. Both spellings a caller
           might type ("ink", "--space-") normalise to the same bare family,
           which is then matched exactly or as a parent. */
        const family = `--${prefix.replace(/^--/, '').replace(/-$/, '')}`;
        matches = matches.filter(
          (token) => token.name === family || token.name.startsWith(`${family}-`),
        );
      }
      if (query) {
        const wanted = query.toLowerCase();
        matches = matches.filter(
          (token) =>
            token.name.toLowerCase().includes(wanted) ||
            (token.comment ?? '').toLowerCase().includes(wanted),
        );
      }
      if (matches.length === 0) {
        return failure(
          `No token matches ${prefix ? `prefix "${prefix}"` : `"${query}"`}. ` +
            `Prefixes: ${tokenPrefixes(tokens).join(', ')}.`,
        );
      }

      const { dials, entries } = await designDials();
      const byName = new Map(entries.map((entry) => [entry.name, entry]));
      const shown = matches.slice(0, limit);
      const lines = [
        `Values are per COMBINATION of palette and theme, written \`<palette>/<theme>\`. The ` +
          `default — a root element with no attributes — is ${dials.defaultCombinationId()}, ` +
          `one of ${dials.COMBINATIONS.length}. A token shown with a single unlabelled value ` +
          `has that value in every combination; a token that varies is listed once per ` +
          `combination. Platform overrides are appended with their selector. Call get_dials ` +
          `for the full roster.`,
        '',
        ...shown.map((token) => renderToken(dials, token, byName.get(token.name))),
      ];
      if (matches.length > shown.length) {
        lines.push(`… ${matches.length - shown.length} more — raise limit or narrow the filter.`);
      }
      return text(lines.join('\n'));
    },
  );

  server.registerTool(
    'get_constraints',
    {
      title: 'Get UX constraints',
      description:
        'The machine-checkable UX contracts from @elirobinson/ai-patterns/contracts — ' +
        'touch targets, focus-visible, contrast, import rules. Scope by component to get ' +
        'only the constraints that apply to it.',
      inputSchema: z.object({
        component: z.string().optional().describe('Limit to one component, by name or slug'),
      }),
    },
    async ({ component: componentName }) => {
      const { componentConstraints = {}, uiContracts } = contracts();
      let entries = Object.entries(componentConstraints);
      let heading = 'All design-system constraints';
      if (componentName) {
        const component = findComponent(componentName);
        if (!component) {
          return failure(
            `No component "${componentName}". Components: ${componentNames().join(', ')}.`,
          );
        }
        entries = entries.filter(([id]) => component.constraints.includes(id));
        heading = `Constraints that apply to ${component.name}`;
      }
      return text(
        [
          `# ${heading}`,
          '',
          ...entries.map(([id, entry]) => `- **${id}** — ${entry.summary} Check: ${entry.check}`),
          '',
          `UI contracts: minimum touch target ${uiContracts.minimumTouchTarget} (scoped), ` +
            `focus-visible required: ${uiContracts.focusVisibleRequired}, ` +
            `contrast level ${uiContracts.contrastLevel}.`,
        ].join('\n'),
      );
    },
  );

  server.registerTool(
    'get_brand_guidance',
    {
      title: 'Get brand guidance',
      description:
        'The Miltinson brand voice rules (words to use and avoid, tone, casing) plus the ' +
        'UI kit and asset pointers for the surface being built — the material that makes a ' +
        'page Miltinson rather than merely correct.',
      inputSchema: z.object({
        surface: z
          .string()
          .optional()
          .describe('What is being built — one of the UI kit names, e.g. "webapp" or "marketing"'),
      }),
    },
    async ({ surface }) => {
      const voice = await brandVoiceRules();
      const kits = shippedKits();
      let chosen = kits;
      if (surface) {
        const wanted = surface.toLowerCase();
        chosen = kits.filter(
          (kit) => kitSlug(kit).includes(wanted) || kit.title.toLowerCase().includes(wanted),
        );
        if (chosen.length === 0) {
          return failure(`No UI kit matches "${surface}". Kits: ${kits.map(kitSlug).join(', ')}.`);
        }
      }
      const kitLines = chosen.map(
        (kit) =>
          `- ${kit.title} — ${kit.path} in the miltinson-design skill` +
          (kit.components?.length ? ` (components: ${kit.components.join(', ')})` : ''),
      );
      return text(
        [
          '# Miltinson brand guidance',
          '',
          'The kits and assets below ship in the `miltinson-design` skill ' +
            '(`.claude/skills/miltinson-design/` after `ds-resync artifacts`, or ' +
            '`@elirobinson/ai-patterns/dist/artifacts/skills/miltinson-design/`). ' +
            'Always link `colors_and_type.css` and use the wordmark from `assets/`.',
          '',
          '## Starting points',
          ...kitLines,
          '',
          '## Voice and content rules',
          '',
          voice,
        ].join('\n'),
      );
    },
  );

  server.registerTool(
    'check_adherence',
    {
      title: 'Check a snippet for adherence',
      description:
        'Runs the design-system adherence checks over a JS/JSX snippet: raw hex colors and ' +
        'px values, components the system does not export, variant unions, and closed prop ' +
        'surfaces — the same rules @elirobinson/ai-patterns generates from the installed ' +
        'manifest.',
      inputSchema: z.object({
        code: z.string().describe('A JS/JSX snippet to check'),
      }),
    },
    async ({ code }) => {
      const config = await adherenceConfig();
      const { Linter } = await import('eslint');
      const linter = new Linter();
      const messages = linter.verify(code, {
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: {
          'no-restricted-syntax': config.rules['no-restricted-syntax'],
        },
      });
      if (messages.some((message) => message.fatal)) {
        const fatal = messages.find((message) => message.fatal);
        return failure(
          `The snippet does not parse as JS/JSX (line ${fatal.line}): ${fatal.message} ` +
            'Pass a parseable fragment — a component, a JSX expression, or a module.',
        );
      }
      if (messages.length === 0) {
        return text(
          'No adherence findings — the snippet respects the system as far as static checks see.',
        );
      }
      return text(
        [
          `${messages.length} adherence finding(s):`,
          ...messages.map((message) => `- line ${message.line}: ${message.message}`),
        ].join('\n'),
      );
    },
  );

  /* -- Resources: the review-conversation mirrors ------------------------ */

  server.registerResource(
    'brand-voice',
    'miltinson://brand/voice',
    {
      title: 'Miltinson brand voice',
      description: 'Voice, tone, casing, and word-choice rules for Miltinson surfaces.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await brandVoiceRules() }],
    }),
  );

  server.registerResource(
    'constraints',
    'miltinson://constraints',
    {
      title: 'Design-system constraints',
      description: 'The full machine-checkable contract set from @elirobinson/ai-patterns.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(contracts(), null, 2),
        },
      ],
    }),
  );

  return server;
}
