// Every command is a pure function of the resolved environment and returns
// { text, exitCode }. The bin (cli.mjs) is the only thing that writes or exits,
// which keeps all of this directly testable.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  cssClasses,
  cssVariables,
  PATTERNS_PKG,
  REACT_PKG,
  readFile,
  TOKENS_PKG,
  walk,
} from './discovery.mjs';

const REPO = 'https://github.com/EliRobinson/design-system';

function ok(text) {
  return { text, exitCode: 0 };
}

function fail(text) {
  return { text, exitCode: 1 };
}

function installHint(...packages) {
  // react and tokens ship code the app renders; ai-patterns is tooling only.
  const runtime = packages.filter((name) => name !== PATTERNS_PKG);
  const tooling = packages.filter((name) => name === PATTERNS_PKG);
  const spec = (names) => names.map((name) => `${name}@latest`).join(' ');

  return [
    `Not installed: ${packages.join(', ')}.`,
    '',
    '  export NODE_AUTH_TOKEN=<github-pat-with-read:packages>',
    ...(runtime.length ? [`  pnpm add ${spec(runtime)}`] : []),
    ...(tooling.length ? [`  pnpm add -D ${spec(tooling)}`] : []),
  ].join('\n');
}

function group(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function summarizeVariants(component) {
  return component.variants.map(({ prop, values }) => `${prop}: ${values.join('|')}`).join('  ');
}

export function usage() {
  return ok(`Usage: ds [command]

  list              Components, hooks, typography classes, token groups (default)
  props <Name>      Full prop/variant types for one component
  tokens [filter]   Design tokens and their values
  classes [filter]  CSS classes the design system ships
  contracts         Machine-checkable rules your UI must satisfy
  patterns          AI product patterns
  prompts [name]    Reusable prompt templates
  init --agents     Install the agent-instruction files into this repo

Shorthand: \`ds Button\` is \`ds props Button\`.
Everything is read from node_modules at run time, so it matches the installed
versions exactly — including the component directory layout, which is
discovered rather than assumed.`);
}

export function list(env) {
  const lines = [];
  const missing = Object.entries(env.versions)
    .filter(([, version]) => !version)
    .map(([name]) => name);

  lines.push(
    Object.entries(env.versions)
      .map(([name, version]) => (version ? `${name}@${version}` : `${name} (not installed)`))
      .join('  '),
  );
  lines.push(`Source of truth: ${REPO}`);
  if (missing.length) lines.push('', installHint(...missing));

  const { inventory } = env;

  if (inventory?.components.length) {
    lines.push(
      '',
      `COMPONENTS (${inventory.components.length})  import { X } from '${inventory.package}/components/<subpath>'`,
    );

    for (const [tier, members] of group(inventory.components, (entry) => entry.tier ?? '')) {
      if (tier) lines.push('', `  ${tier}/`);
      for (const component of members) {
        lines.push(`    ${component.name.padEnd(16)} ${component.exports.join(', ')}`);
        const variants = summarizeVariants(component);
        if (variants) lines.push(`    ${''.padEnd(16)} ${variants}`);
      }
    }
  } else if (env.react) {
    lines.push('', `No components found in ${env.react}. Has the package been built?`);
  }

  if (inventory?.hooks.length) {
    lines.push('', `HOOKS  import { x } from '${inventory.package}/hooks/<name>'`);
    lines.push(`  ${inventory.hooks.map((hook) => hook.name).join('  ')}`);
  }

  const typography = cssClasses(env.tokenStylesheets);
  if (typography.length) {
    lines.push('', 'TYPOGRAPHY CLASSES  use these instead of ad-hoc font-size utilities');
    lines.push(`  ${typography.join('  ')}`);
  }

  const variables = cssVariables(env.tokenStylesheets);
  if (variables.length) {
    const prefixes = group(variables, ({ name }) => name.split('-')[2] ?? name);
    lines.push('', `TOKENS  ${variables.length} custom properties — \`ds tokens\` for values`);
    lines.push(`  groups: ${[...prefixes.keys()].slice(0, 24).join(', ')}`);
    lines.push(
      `  Tailwind v4: @import '${TOKENS_PKG}/tailwind.css' maps these onto bg-*/text-*/border-*`,
    );
  }

  if (env.patterns) {
    lines.push('', 'AI PATTERNS  `ds patterns`, `ds contracts`, `ds prompts`, `ds init --agents`');
  }

  if (inventory?.source === 'declarations') {
    lines.push(
      '',
      `Note: ${inventory.package}@${inventory.version} ships no manifest.json, so the above was`,
      '  recovered from emitted declarations. Variant prop names are inferred.',
    );
  }

  lines.push('', 'Next: `ds props <Name>` for props, `ds tokens color` for values.');
  return ok(lines.join('\n'));
}

export function props(env, name) {
  if (!name) return usage();

  const { inventory } = env;
  if (!inventory?.components.length) return fail(installHint(REACT_PKG));

  const match =
    inventory.components.find((entry) => entry.subpath === name) ??
    inventory.components.find((entry) => entry.name === name) ??
    inventory.components.find((entry) => entry.name.toLowerCase() === name.toLowerCase());

  if (!match) {
    return fail(
      `No component named "${name}".\n\nAvailable: ${inventory.components
        .map((entry) => entry.subpath)
        .join(', ')}`,
    );
  }

  const lines = [
    `// ${inventory.package}@${inventory.version}`,
    `import { ${match.exports.join(', ')} } from '${match.importSpecifier}';`,
  ];

  if (match.variants.length) {
    lines.push('', '// Variants');
    for (const { prop, type, values } of match.variants) {
      lines.push(
        `//   ${prop}${type ? ` (${type})` : ''}: ${values.map((v) => JSON.stringify(v)).join(' | ')}`,
      );
    }
  }

  const declaration =
    readFile(join(env.react, 'dist', 'components', `${match.subpath}.d.ts`)) ??
    readFile(join(env.react, 'src', 'components', `${match.subpath}.tsx`)) ??
    readFile(join(env.react, 'src', 'components', `${match.subpath}.ts`));

  if (declaration) {
    lines.push('', declaration.replace(/\/\/# sourceMappingURL.*\n?/, '').trim());
  } else {
    lines.push('', `// Exports: ${match.exports.join(', ')}`);
    if (match.propsType) lines.push(`// Props type: ${match.propsType}`);
  }

  const source = join(env.react, 'src', 'components', `${match.subpath}.tsx`);
  if (existsSync(source)) lines.push('', `// Implementation: ${source}`);

  return ok(lines.join('\n'));
}

export function tokens(env, filter) {
  if (!env.tokenStylesheets) return fail(installHint(TOKENS_PKG));

  const variables = cssVariables(env.tokenStylesheets).filter(
    ({ name, value }) => !filter || name.includes(filter) || value.includes(filter),
  );

  if (!variables.length) return fail(`No tokens match "${filter}".`);

  const width = Math.max(...variables.map(({ name }) => name.length));
  return ok(
    [
      ...variables.map(({ name, value }) => `  ${name.padEnd(width)}  ${value}`),
      '',
      'Use as var(--token), a Tailwind arbitrary value — text-[var(--fg-2)] — or, with',
      `@import '${TOKENS_PKG}/tailwind.css', the mapped utilities: bg-background, text-muted-foreground.`,
    ].join('\n'),
  );
}

export function classes(env, filter) {
  const all = [...cssClasses(env.tokenStylesheets), ...cssClasses(env.componentCss)].filter(
    (name) => !filter || name.includes(filter),
  );

  if (!all.length) {
    return fail(filter ? `No classes match "${filter}".` : installHint(REACT_PKG, TOKENS_PKG));
  }

  const lines = [];
  for (const [prefix, names] of group(all, (name) => name.split('__')[0].split('--')[0])) {
    lines.push(`  ${prefix.padEnd(24)} ${[...new Set(names)].join(' ')}`);
  }
  return ok(lines.join('\n'));
}

export function contracts(env) {
  if (!env.patterns) return fail(installHint(PATTERNS_PKG));

  const parsed = JSON.parse(readFile(join(env.patterns, 'src', 'contracts.json')));
  const { componentConstraints = {}, ...rest } = parsed;
  const lines = [];

  for (const [section, body] of Object.entries(rest)) {
    // `verifiedBy` is a sibling map keyed by contract name, kept out of the
    // values themselves so a consumer reading uiContracts.minimumTouchTarget
    // still gets "44x44" rather than an object.
    const { verifiedBy = {}, ...entries } = body;

    lines.push(section.toUpperCase());
    for (const [key, value] of Object.entries(entries)) {
      lines.push(`  ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
      if (verifiedBy[key]) lines.push(`    verified by: ${verifiedBy[key]}`);
    }
    lines.push('');
  }

  lines.push('COMPONENT CONSTRAINTS  every one of these must hold');
  for (const [name, { summary, check, verifiedBy }] of Object.entries(componentConstraints)) {
    lines.push('', `  ${name}`, `    ${summary}`, `    check: ${check}`);
    if (verifiedBy) lines.push(`    verified by: ${verifiedBy}`);
  }

  return ok(lines.join('\n'));
}

export function patterns(env) {
  if (!env.patterns) return fail(installHint(PATTERNS_PKG));
  return ok(readFile(join(env.patterns, 'src', 'patterns.md')).trim());
}

export function prompts(env, name) {
  if (!env.patterns) return fail(installHint(PATTERNS_PKG));

  const dir = join(env.patterns, 'src', 'prompts');
  const available = walk(dir, '.md')
    .map((path) =>
      path
        .slice(dir.length + 1)
        .split(/[\\/]/)
        .join('/'),
    )
    .map((path) => path.replace(/\.md$/, ''))
    .sort();

  if (!name) {
    return ok(
      [
        `Prompt templates in ${PATTERNS_PKG}:`,
        '',
        ...available.map((entry) => `  ${entry.padEnd(20)} ds prompts ${entry}`),
      ].join('\n'),
    );
  }

  if (!available.includes(name)) {
    return fail(`No prompt named "${name}".\n\nAvailable: ${available.join(', ')}`);
  }

  return ok(readFile(join(dir, `${name}.md`)).trim());
}
