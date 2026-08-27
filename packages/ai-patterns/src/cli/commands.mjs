// Every command is a pure function of the resolved environment and returns
// { text, exitCode }. The bin (cli.mjs) is the only thing that writes or exits,
// which keeps all of this directly testable.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { renderVoice } from '../voice/render.mjs';
import { resolveVoicePack } from '../voice/resolve.mjs';
import {
  cssClasses,
  cssVariables,
  loadDials,
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
  dials             The root-element attributes tokens resolve under
  classes [filter]  CSS classes the design system ships
  contracts         Machine-checkable rules your UI must satisfy
  patterns          AI product patterns
  prompts [name]    Reusable prompt templates
  voice             The brand voice pack in force, and where it came from
  init --agents     Install the agent-instruction files into this repo
  init --voice      Scaffold a voice.json to declare your own voice pack

Shorthand: \`ds Button\` is \`ds props Button\`.
Everything is read from node_modules at run time, so it matches the installed
versions exactly — including the component directory layout, which is
discovered rather than assumed.
Tokens do not have one value each. They resolve under root-element attributes,
so most carry one value per palette/theme combination and some move again per
platform: \`ds dials\` is that map, and \`ds tokens\` labels every value that
differs from the default.`);
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

const TAILWIND_HINT = [
  'Use as var(--token), a Tailwind arbitrary value — text-[var(--fg-2)] — or, with',
  `@import '${TOKENS_PKG}/tailwind.css', the mapped utilities: bg-background, text-muted-foreground.`,
];

/**
 * What to say when the installed tokens package has no dial roster to read.
 *
 * Named rather than inlined because two commands hit it and they must say the
 * same thing: one of them still answers the question (with the default
 * combination alone) and one cannot, and a consumer comparing the two should
 * not have to work out whether they are the same problem.
 */
function predatesDials(env) {
  const version = env.versions[TOKENS_PKG];
  return [
    `${TOKENS_PKG}@${version ?? '(unknown)'} predates the dial roster, so the values above are`,
    '  the default combination only — the palette, theme and platform variants cannot be read',
    `  from it. Upgrade it: pnpm add ${TOKENS_PKG}@latest`,
  ].join('\n');
}

/* The selector a platform override is written under.
 *
 * Built from `dialAttributeString` rather than assembled here, so the
 * attribute name comes from the roster like every other mention of it. An
 * attribute selector with a double-quoted value is the same selector as the
 * single-quoted one the stylesheet happens to use.
 */
function platformSelector(api, platform) {
  return `[${api.dialAttributeString({ platform })}]`;
}

/**
 * The printing rule, in one place: a token that does not vary prints one value
 * and no combination labels, and a token that does prints one labelled row per
 * combination in COMBINATIONS order. Platform overrides are appended either
 * way — a uniform token with an override still moves, and a reader who filtered
 * down to that one token would otherwise be told a value that is wrong on a
 * phone.
 */
function tokenRows(api, entry, nameWidth, labelWidth) {
  const rows = entry.varies
    ? [
        `  ${entry.name}`,
        ...entry.values.map(
          ({ combination, value }) =>
            `    ${combination.padEnd(labelWidth)}  ${value ?? '(not declared)'}`,
        ),
      ]
    : [`  ${entry.name.padEnd(nameWidth)}  ${api.defaultValueOf(entry)}`];

  return [
    ...rows,
    ...entry.platforms.map(
      ({ platform, value }) =>
        `    ${platformSelector(api, platform).padEnd(labelWidth)}  ${value}`,
    ),
  ];
}

export async function tokens(env, filter) {
  if (!env.tokenStylesheets) return fail(installHint(TOKENS_PKG));

  const loaded = await loadDials(env);
  if (!loaded) return tokensOfDefaultCombination(env, filter);

  const { dials: api, sources, platformCss } = loaded;

  /* One filter over every value a token has, not just the default one: a token
     whose slate value is the only place a colour appears would otherwise be
     unfindable by that colour, which is the same class of miss as printing one
     combination out of four. */
  const matches = ({ name, values, platforms }) =>
    !filter ||
    name.includes(filter) ||
    values.some(({ value }) => value?.includes(filter)) ||
    platforms.some(({ value }) => value.includes(filter));

  const entries = api.tokenDials(sources, { platformCss }).filter(matches);
  if (!entries.length) return fail(`No tokens match "${filter}".`);

  const nameWidth = Math.max(...entries.map(({ name }) => name.length));
  const labelWidth = Math.max(
    ...api.COMBINATIONS.map(({ id }) => id.length),
    ...api.PLATFORMS.map((platform) => platformSelector(api, platform).length),
  );

  return ok(
    [
      ...entries.flatMap((entry) => tokenRows(api, entry, nameWidth, labelWidth)),
      '',
      `An unlabelled value is the same in all ${api.COMBINATIONS.length} combinations; a labelled one names its own.`,
      `The default combination is ${api.defaultCombinationId()} — what a root element with no attributes`,
      'renders — and `ds dials` is the map of the attributes that select the rest.',
      'Values are resolved: a `var()` chain is followed to what it lands on.',
      '',
      ...TAILWIND_HINT,
    ].join('\n'),
  );
}

/**
 * `ds tokens` against a tokens package too old to have a dial roster.
 *
 * Deliberately still answers. The default combination is what this reader has
 * always printed and it is correct as far as it goes; the note is there so
 * that "as far as it goes" is on screen rather than inferred from values that
 * look complete.
 */
function tokensOfDefaultCombination(env, filter) {
  const variables = cssVariables(env.tokenStylesheets).filter(
    ({ name, value }) => !filter || name.includes(filter) || value.includes(filter),
  );

  if (!variables.length) return fail(`No tokens match "${filter}".`);

  const width = Math.max(...variables.map(({ name }) => name.length));
  return ok(
    [
      ...variables.map(({ name, value }) => `  ${name.padEnd(width)}  ${value}`),
      '',
      predatesDials(env),
      '',
      ...TAILWIND_HINT,
    ].join('\n'),
  );
}

/**
 * `ds dials` — the attributes a token's value depends on.
 *
 * Every list, count and row below is read from the installed package's roster.
 * There is no palette, theme, platform or combination named in this file: a
 * third palette has to reach this output with no edit here, and cli.test.mjs
 * asserts that by checking the output against the roster rather than against
 * an expected string.
 */
export async function dials(env) {
  if (!env.tokenStylesheets) return fail(installHint(TOKENS_PKG));

  const loaded = await loadDials(env);
  if (!loaded) return fail(predatesDials(env));

  const { dials: api, sources, platformCss } = loaded;
  const entries = api.tokenDials(sources, { platformCss });
  const owned = api.dialOwnership(sources, platformCss);

  const nameWidth = Math.max(...api.DIALS.map((dial) => dial.name.length));
  const attributeWidth = Math.max(...api.DIALS.map((dial) => dial.attribute.length));

  const lines = [
    `DIALS  ${api.DIALS.length} attributes on the root element; an absent attribute is the default`,
  ];

  for (const dial of api.DIALS) {
    const values = dial.values
      .map((value) => (value === dial.default ? `${value} (default)` : value))
      .join('  ');
    lines.push(
      '',
      `  ${dial.name.padEnd(nameWidth)}  ${dial.attribute.padEnd(attributeWidth)}  ${values}`,
      `  ${''.padEnd(nameWidth)}  ${owned[dial.name].length} tokens — ${dial.owns}`,
    );
  }

  /* The axes a combination is made of, asked of a combination rather than
     stated: the day contrast.mjs grows a third colour dial, this header and
     the ids below widen together instead of this line becoming a lie. */
  const axes = Object.keys(api.COMBINATIONS[0])
    .filter((key) => key !== 'id')
    .join(' x ');
  const idWidth = Math.max(...api.COMBINATIONS.map(({ id }) => id.length));

  lines.push('', `COMBINATIONS (${api.COMBINATIONS.length})  ${axes} — the dials that move colour`);

  for (const combination of api.COMBINATIONS) {
    const attributes = api.dialAttributeString(combination);
    lines.push(
      `  ${combination.id.padEnd(idWidth)}  ${attributes || '(no attributes — this is the default)'}`,
    );
  }

  /* The platform is reported here, on top of the combinations, and never
     folded into a combination id. The reason is load-bearing: the platform
     stylesheet deliberately declares no colour — every measured contrast ratio
     in the package depends on that — so the platform axis is orthogonal to the
     four colour combinations. Multiplying them out would print eight columns,
     four of them duplicates, and bury the handful of tokens that actually
     move. */
  for (const platform of api.PLATFORMS) {
    const overrides = entries
      .map((entry) => ({
        entry,
        override: entry.platforms.find((one) => one.platform === platform),
      }))
      .filter(({ override }) => override);

    if (!overrides.length) continue;

    const dial = api.dialNamed('platform');
    const width = Math.max(...overrides.map(({ entry }) => entry.name.length));

    lines.push(
      '',
      `PLATFORM  ${api.dialAttributeString({ platform })} re-points ${overrides.length} of ` +
        `${entries.length} tokens, on top of all ${api.COMBINATIONS.length} combinations`,
      `  each row is the ${dial.default} value -> the ${platform} value`,
      '',
    );

    for (const { entry, override } of overrides) {
      /* `<default> -> <platform>` is only the whole story while the token has
         one default value; one that also varied by combination would need its
         own rows, so it is sent to the command that prints them. */
      const varies = entry.varies ? '  (and by combination — `ds tokens`)' : '';
      lines.push(
        `  ${entry.name.padEnd(width)}  ${api.defaultValueOf(entry)} -> ${override.value}${varies}`,
      );
    }
  }

  const varying = entries.filter((entry) => entry.varies).length;

  lines.push(
    '',
    `${varying} of ${entries.length} tokens differ across combinations — \`ds tokens <name>\` for values.`,
    `The default combination is ${api.defaultCombinationId()}: what a root element with no`,
    'attributes renders, and what every unlabelled value in this CLI belongs to.',
  );

  return ok(lines.join('\n'));
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

/**
 * The voice pack in force, and which one it is.
 *
 * Naming the pack is the whole command. A consumer who has declared nothing inherits
 * this system's pack, and inheriting silently is indistinguishable from being ruled —
 * which is the thing `docs/agents/brand-boundary.md` says the system may not do. So the
 * default case says it is a default and says how to replace it.
 *
 * The throw is caught rather than left to the bin: a stack trace tells a consumer that
 * something in a node_modules file failed, when what actually happened is that their own
 * voice.json is wrong and is not being used.
 */
export function voice(env = {}) {
  let resolved;
  try {
    resolved = resolveVoicePack({ cwd: env.cwd });
  } catch (error) {
    return fail(
      `${error.message}\n\nFix it or delete it — ds will not fall back to another brand's voice.`,
    );
  }

  const { pack, source, path } = resolved;

  const header =
    source === 'consumer'
      ? [`pack: ${pack.id} (${pack.label}) — yours, from ${path}`]
      : [
          `pack: ${pack.id} (${pack.label}) — the system default, not a rule of the system.`,
          'Declare your own with `ds init --voice`, then edit voice.json.',
        ];

  return ok([...header, '', renderVoice(pack)].join('\n'));
}
