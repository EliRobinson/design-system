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

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { designSystem } from '@elirobinson/eslint-config';
import { designSystemCss } from '@elirobinson/eslint-config/css';
import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { Linter } from 'eslint';

const require = createRequire(import.meta.url);

function resolves(specifier) {
  try {
    require.resolve(specifier);
    return true;
  } catch {
    return false;
  }
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
  const bridge = readFileSync(require.resolve('@elirobinson/tokens/tailwind.css'), 'utf8');
  const tailwind = { color: new Set(), radius: new Set(), shadow: new Set(), font: new Set() };
  for (const [, namespace, key] of bridge.matchAll(
    /^\s*--(color|radius|shadow|font)-([\w-]+):/gm,
  )) {
    tailwind[namespace].add(key);
  }

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

/* ------------------------------------------------------------------ */
/* Markdown → blocks and table cells. */

const FENCE = /^```([^\n]*)\n([\s\S]*?)^```$/gm;
const SIDES = new Set(['before', 'after']);
const EXEMPT_LANGUAGES = new Set(['bash', 'sh', 'shell', 'text']);

/** @returns {{ lang: string, side: string | null, code: string, line: number }[]} */
export function fencedBlocks(markdown) {
  const blocks = [];
  for (const match of markdown.matchAll(FENCE)) {
    const [lang = '', side = null, ...rest] = match[1].trim().split(/\s+/);
    const line = markdown.slice(0, match.index).split('\n').length;
    blocks.push({ lang, side, extra: rest, code: match[2], line });
  }
  return blocks;
}

function stripFences(markdown) {
  return markdown.replace(FENCE, '');
}

function cells(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

/** Every Markdown table, as header + rows of cells. */
export function tables(markdown) {
  const found = [];
  const lines = stripFences(markdown).split('\n');
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].trim().startsWith('|') || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue;
    const header = cells(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith('|')) {
      rows.push({ cells: cells(lines[j]), line: j + 1 });
      j += 1;
    }
    found.push({ header, rows });
    i = j;
  }
  return found;
}

export function backticked(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

/* ------------------------------------------------------------------ */
/* Checks. Each returns a list of problem strings; empty means clean. */

const TOKEN_REF = /(?<![\w-])--[a-z][a-z0-9-]*/g;

/** Every custom property named in `code` is shipped, or declared in `code` itself. */
export function checkTokens(code, vocab) {
  const declared = new Set(
    [...code.matchAll(/(?<![\w-])(--[a-z][a-z0-9-]*)\s*:/g)].map((m) => m[1]),
  );
  const problems = [];
  for (const [name] of code.matchAll(TOKEN_REF)) {
    if (vocab.tokens.has(name) || declared.has(name)) continue;
    problems.push(`token ${name} is not declared by @elirobinson/tokens`);
  }
  return problems;
}

/* Words after `text-` / `border-` that are not colours in Tailwind. */
const TEXT_NON_COLOR =
  /^(?:xs|sm|base|lg|[2-9]?xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/;
const BORDER_NON_COLOR =
  /^(?:\d+|[trblxyse]|[trblxyse]-\d+|solid|dashed|dotted|double|hidden|none|collapse|separate)$/;
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
    const color = utility.match(/^(bg|text|border|ring|outline|fill|stroke|divide)-([a-z][\w-]*)$/);
    if (!color) continue;
    const [, prefix, key] = color;
    if (prefix === 'text' && TEXT_NON_COLOR.test(key)) continue;
    if ((prefix === 'border' || prefix === 'divide') && BORDER_NON_COLOR.test(key)) continue;
    if (
      (prefix === 'ring' || prefix === 'outline') &&
      /^(?:\d+|offset-\d+|none|inset|dashed|dotted|solid)$/.test(key)
    )
      continue;
    if (
      prefix === 'bg' &&
      /^(?:none|cover|contain|center|fixed|local|scroll|repeat|no-repeat|clip-[\w-]+|origin-[\w-]+|linear-[\w-]+|gradient-[\w-]+)$/.test(
        key,
      )
    )
      continue;
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
    if (!specifier.startsWith('@elirobinson/react')) return;
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
    if (
      node.type === 'JSXAttribute' &&
      node.name.name === 'className' &&
      node.value?.type === 'Literal'
    ) {
      problems.push(...checkUtilities(node.value.value, vocab));
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
      if (union && attribute.value?.type === 'Literal' && !union.has(attribute.value.value)) {
        problems.push(
          `<${tag} ${name}="${attribute.value.value}">: not one of ${[...union].join(', ')}`,
        );
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
  return [...problems, ...checkTokens(code, vocab)];
}

const CHECKERS = { jsx: checkJsx, tsx: checkJsx, css: checkCss, html: checkHtml };

/** Check one `after` block by its language. */
export function checkAfterBlock(block, vocab) {
  const checker = CHECKERS[block.lang];
  if (!checker)
    return [`\`\`\`${block.lang} after: no checker for this language; use jsx, css or html`];
  return checker(block.code, vocab);
}

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
  if (span.startsWith('--')) return checkTokens(span, vocab);
  if (/^@elirobinson\//.test(span)) return resolves(span) ? [] : [`${span} does not resolve`];
  if (/^[A-Z]\w*$/.test(span)) {
    return vocab.components.has(span) ? [] : [`${span} is not exported by @elirobinson/react`];
  }
  if (/^[a-z][\w-]*(?:\s+[a-z!][\w:/!-]*)*$/.test(span)) return checkUtilities(span, vocab);
  return checkTokens(span, vocab);
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
  const family = token.replace(/-[\w]+$/, '-');
  const scale = [...vocab.tokens]
    .filter(([name]) => name.startsWith(family) && !/-(?:pill|px)$/.test(name))
    .map(([name, value]) => ({ name, px: px(value) }))
    .filter((entry) => entry.px !== null);
  const best = Math.min(...scale.map((entry) => Math.abs(entry.px - sourcePx)));
  return scale.filter((entry) => Math.abs(entry.px - sourcePx) === best).map((entry) => entry.name);
}

export function migrateFiles(root) {
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith('.md'))
      found.push(join(entry.parentPath, entry.name));
  }
  return found.sort();
}

export { EXEMPT_LANGUAGES, SIDES };
