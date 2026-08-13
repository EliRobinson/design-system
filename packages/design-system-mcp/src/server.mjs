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
 *   every primary surface here is a tool.
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

function tokenPrefixes(tokens) {
  return [...new Set(tokens.map((token) => token.name.match(/^--[a-z]+-/)?.[0]).filter(Boolean))];
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
    'search_tokens',
    {
      title: 'Search design tokens',
      description:
        'Design tokens from the installed @elirobinson/tokens tokens.css: name, declared ' +
        'value, resolved value, and comment. Filter by prefix ("ink", "--space-") or a ' +
        'substring of the name or comment.',
      inputSchema: z.object({
        query: z.string().optional().describe('Substring of the token name or its comment'),
        prefix: z.string().optional().describe('Token family prefix, e.g. "ink" or "--space-"'),
        limit: z.number().int().positive().max(200).default(20),
      }),
    },
    async ({ query, prefix, limit }) => {
      const tokens = await designTokens();
      let matches = tokens;
      if (prefix) {
        const normalized = `--${prefix.replace(/^--/, '').replace(/-$/, '')}-`;
        matches = matches.filter((token) => token.name.startsWith(normalized));
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
      const shown = matches.slice(0, limit);
      const lines = shown.map(
        (token) =>
          `${token.name}: ${token.value}` +
          (token.resolved !== token.value ? ` (resolves to ${token.resolved})` : '') +
          (token.comment ? ` — ${token.comment}` : ''),
      );
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
