/* Reads the migration pattern files the way an agent does, and checks every name in
 * them against what the packages actually ship.
 *
 * Not a published module: the `.test-helper.mjs` suffix is outside both Vitest's include
 * glob and this package's `files`.
 *
 * The files are prose with code in them, so the convention that makes them checkable is
 * small and enforced here rather than hoped for:
 *
 * - Every fenced block says which side of the migration it is on: ```tsx before,
 *   ```css after. A `before` block is the source system and is never checked; an `after`
 *   block is ours and every name in it is. A block that says neither fails, so nothing
 *   reaches a consumer unchecked by forgetting a word. Shell blocks (`bash`) are exempt.
 * - A Markdown table with a `Miltinson` (or `HTML classes`) column is a mapping table, and
 *   every backticked span in that column is checked as `after` code.
 * - A table that also has a `Source px` column is a scale table: its Miltinson cell must
 *   be the token on that scale nearest the source value, so a re-tuned scale fails the
 *   table instead of quietly making it wrong.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { designSystem } from '@elirobinson/eslint-config';
import { designSystemCss } from '@elirobinson/eslint-config/css';
import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { Linter } from 'eslint';

import { findPackageDir } from '../package-lookup.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/* Resolved through the package's exports map with the `import` condition, the way a
   consumer's bundler resolves it. CommonJS `require.resolve` cannot see react's
   `./components/*` and `./hooks/*`, which have only an `import` condition, and
   `import.meta.resolve` is not available inside Vitest. */
function resolves(specifier) {
  const [scope, name, ...rest] = specifier.split('/');
  const dir = findPackageDir(`${scope}/${name}`, [here]);
  if (!dir) return false;
  const { exports = {} } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const subpath = rest.length ? `./${rest.join('/')}` : '.';
  for (const [pattern, target] of Object.entries(exports)) {
    const [head, tail = null] = pattern.split('*');
    let star = null;
    if (tail === null) {
      if (pattern !== subpath) continue;
    } else if (
      subpath.startsWith(head) &&
      subpath.endsWith(tail) &&
      subpath.length >= head.length + tail.length
    ) {
      star = subpath.slice(head.length, subpath.length - tail.length);
    } else continue;
    const file = typeof target === 'string' ? target : (target.import ?? target.default);
    if (
      typeof file === 'string' &&
      existsSync(join(dir, star === null ? file : file.replaceAll('*', star)))
    ) {
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* What the packages ship, read the way a consumer's install reads it. */

export function loadVocabulary() {
  const manifest = JSON.parse(readFileSync(require.resolve('@elirobinson/react/manifest'), 'utf8'));
  const tokensDir = dirname(require.resolve('@elirobinson/tokens/tokens.css'));
  const tokens = new Map();
  for (const token of parseTokensCss(readTokenStylesheets(tokensDir))) {
    if (!tokens.has(token.name)) tokens.set(token.name, token.value);
  }

  /* The Tailwind bridge is the only source of `bg-*` names that mean anything. */
  /* Comments blanked first: the file's prose quotes `--color-*` names it does not declare. */
  const bridge = readFileSync(require.resolve('@elirobinson/tokens/tailwind.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const tailwind = { color: new Set(), radius: new Set(), shadow: new Set(), font: new Set() };
  const colorAlias = new Map(); // `background` → `--bg`
  for (const [, namespace, key, value] of bridge.matchAll(
    /^\s*--(color|radius|shadow|font)-([\w-]+):\s*([^;]+);/gm,
  )) {
    tailwind[namespace].add(key);
    if (namespace === 'color') colorAlias.set(key, value.match(/^var\((--[\w-]+)\)$/)?.[1]);
  }
  tailwind.colorAlias = colorAlias;

  /* Exported names → the component record (or sub-component) that owns their props. */
  const components = new Map();
  for (const record of manifest.components) {
    const subs = new Map(record.subComponents.map((sub) => [sub.name, sub]));
    for (const name of record.exports) {
      const sub = subs.get(name);
      components.set(name, {
        record,
        props: (name === record.name ? record.props : (sub?.props ?? [])) ?? [],
        /* A sub-component's `inherits` is not recorded, so its HTML surface is unknown;
           the root's is, and `null` there means the props are the whole surface. */
        htmlSurface: name === record.name ? record.inherits !== null : true,
      });
    }
  }

  const stylesheets = new Set(['@elirobinson/react/styles.css']);
  for (const record of manifest.components) {
    for (const path of record.stylesheetPaths) stylesheets.add(path);
  }

  /* `ds-*` classes, from the stylesheets the manifest says ship. */
  const classes = new Set();
  for (const specifier of stylesheets) {
    const css = readFileSync(require.resolve(specifier), 'utf8');
    for (const [, name] of css.matchAll(/\.(ds-[\w-]+)/g)) classes.add(name);
  }

  return { manifest, tokens, tailwind, components, stylesheets, classes };
}

/* Which side of a migration a fenced block is on. Parsing lives in markdown.test-helper.mjs. */
const SIDES = new Set(['before', 'after']);
const EXEMPT_LANGUAGES = new Set(['bash', 'sh', 'shell', 'text']);

/* ------------------------------------------------------------------ */
/* Checks. Each returns a list of problem strings; empty means clean. */

const TOKEN_REF = /(?<![\w-])--[a-z][a-z0-9-]*/g;

/* The value of an override hook is the consumer's own variable (`next/font` hands over
   `--font-geist-sans`), so it is the one place a name we do not ship is correct. */
const OVERRIDE_VALUE = /(--ds-[\w-]+-override\s*:)[^;]*/g;

/** Every custom property named in `code` is shipped, or declared in `code` itself. */
export function checkTokens(source, vocab) {
  const code = source.replace(OVERRIDE_VALUE, '$1');
  const declared = new Set(
    [...code.matchAll(/(?<![\w-])(--[a-z][a-z0-9-]*)\s*:/g)].map((m) => m[1]),
  );
  const problems = [...declared]
    .filter((name) => vocab.tokens.has(name) && !/^--ds-[\w-]+-override$/.test(name))
    .map((name) => `${name} redefines a system token; use an override hook or a --product-* token`);
  for (const [name] of code.matchAll(TOKEN_REF)) {
    if (vocab.tokens.has(name) || declared.has(name)) continue;
    problems.push(`token ${name} is not declared by @elirobinson/tokens`);
  }
  return problems;
}

/* Words after a colour prefix that are something else in Tailwind (`text-sm`, `border-2`). */
const BORDER_NON_COLOR =
  /^(?:\d+|[trblxyse]|[trblxyse]-\d+|solid|dashed|dotted|double|hidden|none|collapse|separate)$/;
const NON_COLOR_BY_PREFIX = {
  text: /^(?:xs|sm|base|lg|[2-9]?xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/,
  border: BORDER_NON_COLOR,
  divide: BORDER_NON_COLOR,
  ring: /^(?:\d+|offset-\d+|inset)$/,
  'inset-ring': /^\d+$/,
  outline: /^(?:\d+|offset-\d+|none|hidden|dashed|dotted|double|solid)$/,
  bg: /^(?:none|cover|contain|auto|center|top|bottom|left|right|fixed|local|scroll|repeat|no-repeat|repeat-[xy]|clip-[\w-]+|origin-[\w-]+|linear-[\w-]+|radial|conic|gradient-[\w-]+)$/,
  decoration: /^(?:\d+|auto|from-font|solid|double|dotted|dashed|wavy)$/,
  stroke: /^\d+$/,
  accent: /^auto$/,
  caret: /^auto$/,
  fill: /^none$/,
  from: /^\d+%$/,
  via: /^\d+%$/,
  to: /^\d+%$/,
};
/* `font-*` that sets weight, stretch or smoothing rather than a family. */
const FONT_NON_FAMILY =
  /^(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|stretch-[\w-]+|stretch|features-[\w-]+)$/;
/* Every utility namespace that takes a colour; the same set the shipped lint rule watches. */
const COLOR_UTILITY = new RegExp(
  `^(${Object.keys(NON_COLOR_BY_PREFIX)
    .concat('placeholder')
    .sort((a, b) => b.length - a.length)
    .join('|')})-([a-z][\\w-]*)$`,
);
const ROUNDED = /^rounded(?:-(?:[trblse]|tl|tr|bl|br|ss|se|es|ee))?(?:-([\w-]+))?$/;

/** Tailwind utilities that name a design value resolve through the bridge. */
export function checkUtilities(classList, vocab) {
  const problems = [];
  for (const raw of classList.split(/\s+/).filter(Boolean)) {
    const utility = raw
      .split(':')
      .at(-1)
      .replace(/^!/, '')
      .replace(/\/[\w.[\]]+$/, '');
    if (/\(--/.test(utility)) continue; // `p-(--space-3)` — the token check covers it
    if (utility.startsWith('ds-')) {
      if (!vocab.classes.has(utility))
        problems.push(`class ${utility} is not in any shipped stylesheet`);
      continue;
    }
    const rounded = utility.match(ROUNDED);
    if (rounded) {
      if (rounded[1] && !vocab.tailwind.radius.has(rounded[1]) && rounded[1] !== 'full') {
        problems.push(`${raw}: the bridge maps no radius "${rounded[1]}"`);
      }
      continue;
    }
    const shadow = utility.match(/^shadow-([\w-]+)$/);
    if (shadow) {
      if (!vocab.tailwind.shadow.has(shadow[1]) && !vocab.tailwind.color.has(shadow[1])) {
        problems.push(`${raw}: the bridge maps no shadow "${shadow[1]}"`);
      }
      continue;
    }
    const font = utility.match(/^font-([a-z][\w-]*)$/);
    if (font) {
      if (!FONT_NON_FAMILY.test(font[1]) && !vocab.tailwind.font.has(font[1])) {
        problems.push(`${raw}: the bridge maps no font family "${font[1]}"`);
      }
      continue;
    }
    const color = utility.match(COLOR_UTILITY);
    if (!color) continue;
    const [, prefix, key] = color;
    if (NON_COLOR_BY_PREFIX[prefix]?.test(key)) continue;
    if (!vocab.tailwind.color.has(key)) {
      problems.push(`${raw}: @elirobinson/tokens/tailwind.css maps no colour "${key}"`);
    }
  }
  return problems;
}

/** `ds-*` classes in HTML `class="…"` attributes exist in a shipped stylesheet. */
export function checkHtml(code, vocab) {
  const problems = [];
  for (const [, list] of code.matchAll(/\bclass="([^"]*)"/g))
    problems.push(...checkUtilities(list, vocab));
  return [...problems, ...checkTokens(code, vocab)];
}

/* React and DOM attributes a component that spreads HTML props accepts. Only consulted
   when the manifest says the component forwards an HTML attribute surface. */
const HTML_ATTRIBUTES = new Set(
  (
    'className id style children key ref onClick onChange onSubmit onBlur onFocus onKeyDown ' +
    'onInput href type name value defaultValue checked defaultChecked disabled placeholder ' +
    'required autoComplete autoFocus readOnly min max step rows cols htmlFor role tabIndex ' +
    'title target rel src alt width height form action method multiple maxLength minLength ' +
    'pattern inputMode accept lang dir hidden'
  ).split(' '),
);

const linter = new Linter({ configType: 'flat' });
const JSX_LANGUAGE = {
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
};

function lintMessages(messages) {
  return messages.map((m) => `${m.ruleId ?? 'parse'} (${m.line}:${m.column}): ${m.message}`);
}

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

function jsxName(name) {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return `${jsxName(name.object)}.${name.property.name}`;
  return null;
}

/** `"x"`, `{"x"}` and `` {`x`} `` (no interpolation) as the string; anything else null. */
function staticString(value) {
  const node = value?.type === 'JSXExpressionContainer' ? value.expression : value;
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

/** A union of string literals, as a set of members, or null for anything else. */
function literalUnion(type) {
  if (!type) return null;
  const members = type.split('|').map((part) => part.trim());
  if (!members.every((m) => /^"[^"]*"$/.test(m))) return null;
  return new Set(members.map((m) => m.slice(1, -1)));
}

/**
 * JSX (no type annotations — an agent copies this into any React app, and our lint has to
 * parse it). Checks imports against the manifest, every system component's props and
 * literal variants against its prop table, required props, tokens, Tailwind utilities,
 * and runs @elirobinson/eslint-config over the whole block.
 */
export function checkJsx(code, vocab) {
  const problems = [];
  const messages = linter.verify(code, [...designSystem(), JSX_LANGUAGE], 'snippet.jsx');
  problems.push(...lintMessages(messages));
  if (messages.some((m) => m.fatal)) return problems;

  const ast = linter.getSourceCode().ast;
  const ours = new Map(); // local name → exported name

  walk(ast, (node) => {
    if (node.type !== 'ImportDeclaration') return;
    const specifier = node.source.value;
    if (!specifier.startsWith('@elirobinson/')) return;
    if (!specifier.startsWith('@elirobinson/react')) {
      if (!resolves(specifier)) problems.push(`import ${specifier} does not resolve`);
      return;
    }
    if (specifier.endsWith('.css')) {
      if (!vocab.stylesheets.has(specifier))
        problems.push(`stylesheet ${specifier} is not shipped`);
      return;
    }
    const record = vocab.manifest.components.find((c) => c.importSpecifier === specifier);
    if (!record) {
      /* `./manifest` and `./hooks/*` are real subpaths that are not components. */
      if (!specifier.includes('/components/') && resolves(specifier)) return;
      problems.push(`import ${specifier} is not a component subpath in the manifest`);
      return;
    }
    for (const spec of node.specifiers) {
      const imported = spec.imported?.name ?? spec.local.name;
      if (!record.exports.includes(imported)) {
        problems.push(`${specifier} does not export ${imported}`);
      } else {
        ours.set(spec.local.name, imported);
      }
    }
  });

  walk(ast, (node) => {
    if (node.type === 'JSXAttribute' && node.name.name === 'className') {
      const classes = staticString(node.value);
      if (classes !== null) problems.push(...checkUtilities(classes, vocab));
    }
    if (node.type !== 'JSXOpeningElement') return;
    const tag = jsxName(node.name);
    if (!tag || !/^[A-Z]/.test(tag)) return;
    const exported = ours.get(tag);
    if (!exported) {
      problems.push(`<${tag}> is used but not imported from @elirobinson/react in this block`);
      return;
    }
    const component = vocab.components.get(exported);
    const props = new Map(component.props.map((p) => [p.name, p]));
    const given = new Set();
    for (const attribute of node.attributes) {
      if (attribute.type !== 'JSXAttribute') continue;
      const name = attribute.name.name;
      given.add(name);
      const prop = props.get(name);
      if (!prop) {
        const html =
          component.htmlSurface && (HTML_ATTRIBUTES.has(name) || /^(aria|data)-/.test(name));
        if (!html && name !== 'key') problems.push(`<${tag}> has no prop "${name}"`);
        continue;
      }
      const union = literalUnion(prop.type);
      const value = staticString(attribute.value);
      if (union && value !== null && !union.has(value)) {
        problems.push(`<${tag} ${name}="${value}">: not one of ${[...union].join(', ')}`);
      }
    }
    if (!node.attributes.some((a) => a.type === 'JSXSpreadAttribute')) {
      for (const prop of component.props) {
        if (prop.required && !given.has(prop.name))
          problems.push(`<${tag}> is missing required prop "${prop.name}"`);
      }
    }
  });

  return [...problems, ...checkTokens(code, vocab)];
}

/** CSS: tokens, `@elirobinson/*` imports, and @elirobinson/eslint-config/css. */
export function checkCss(code, vocab) {
  const problems = lintMessages(linter.verify(code, designSystemCss(), 'snippet.css'));
  for (const [, specifier] of code.matchAll(
    /@import\s+(?:url\()?['"](@elirobinson\/[^'"]+)['"]/g,
  )) {
    if (!resolves(specifier)) problems.push(`@import ${specifier} does not resolve`);
  }
  for (const [, name] of code.matchAll(/\.(ds-[\w-]+)/g)) {
    if (!vocab.classes.has(name))
      problems.push(`selector .${name} is not in any shipped stylesheet`);
  }
  return [...problems, ...checkTokens(code, vocab)];
}

const CHECKERS = { js: checkJsx, jsx: checkJsx, tsx: checkJsx, css: checkCss, html: checkHtml };

/** Check one `after` block by its language. */
export function checkAfterBlock(block, vocab) {
  const checker = CHECKERS[block.lang];
  if (!checker)
    return [`\`\`\`${block.lang} after: no checker for this language; use js, jsx, css or html`];
  return checker(block.code, vocab);
}

/* One class: optional variants (`hover:`), `!`, an opacity suffix. Starts with a letter or `!`,
   which keeps it apart from `--tokens` and `<Components>`. */
const CLASS = String.raw`[a-z!][\w:/!-]*`;

/* What a backticked span in a checked column can be, in the order they are tried. A span
   that is none of these fails, the same way an unlabelled fence does. */
const SPAN_KINDS = [
  [/^--[a-z]/, checkTokens],
  [/^@elirobinson\//, (span) => (resolves(span) ? [] : [`${span} does not resolve`])],
  [
    /^[A-Z]\w*$/,
    (span, vocab) =>
      vocab.components.has(span) ? [] : [`${span} is not exported by @elirobinson/react`],
  ],
  [new RegExp(`^${CLASS}(?:\\s+${CLASS})*$`), checkUtilities],
];

/** Check one backticked span from a Miltinson column. */
export function checkMappingSpan(span, vocab) {
  if (span.startsWith('<')) {
    const element = span.endsWith('/>') ? span : span.replace(/>$/, ' />');
    const tags = [...element.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]);
    const imports = tags
      .map((tag) => {
        const owner = vocab.components.get(tag)?.record;
        return owner ? `import { ${tag} } from '${owner.importSpecifier}';` : '';
      })
      .join('\n');
    const problems = tags
      .filter((tag) => !vocab.components.has(tag))
      .map((tag) => `<${tag}> is not exported by @elirobinson/react`);
    return [...problems, ...checkJsx(`${imports}\nexport const x = ${element};\n`, vocab)];
  }
  const kind = SPAN_KINDS.find(([shape]) => shape.test(span));
  if (!kind)
    return [
      `\`${span}\`: not a shape this check knows; write a token, a component, a utility or JSX`,
    ];
  return kind[1](span, vocab);
}

/* ------------------------------------------------------------------ */
/* Scales. */

function px(value) {
  const match = String(value)
    .trim()
    .match(/^(-?[\d.]+)(px|rem)?$/);
  if (!match) return null;
  return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
}

/** The tokens of `token`'s family with a plain px value, nearest first. */
export function nearestOnScale(token, sourcePx, vocab) {
  /* The family is the name minus its last step (`--space-4` → `--space-`). `-pill` and
     `-px` sit outside the stepped scale: nothing should snap to a pill or a hairline. */
  const family = token.replace(/-[\w]+$/, '-');
  const scale = [...vocab.tokens]
    .filter(([name]) => name.startsWith(family) && !/-(?:pill|px)$/.test(name))
    .map(([name, value]) => ({ name, px: px(value) }))
    .filter((entry) => entry.px !== null);
  const best = Math.min(...scale.map((entry) => Math.abs(entry.px - sourcePx)));
  return scale.filter((entry) => Math.abs(entry.px - sourcePx) === best).map((entry) => entry.name);
}

export { EXEMPT_LANGUAGES, SIDES };
