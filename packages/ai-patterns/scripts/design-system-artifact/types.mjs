/* components/index.d.ts and components/<Comp>/<Comp>.d.ts for the Claude
 * "Design System" artifact.
 *
 * The artifact reads props from `<Comp>Props` in index.d.ts and shows them on
 * its api cards. These files are documentation: nothing type-checks them. So
 * each component's dist .d.ts is made self-contained: relative imports are
 * removed, the few shared helper types are inlined, and `type XProps = A & {…}`
 * becomes an interface the card can read.
 *
 * The artifact-only components (artifact-only.mjs) have no dist .d.ts. Their
 * sections are read back from its previous index.d.ts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

import { ARTIFACT_ONLY, inArtifactOrder } from './artifact-only.mjs';

/* Types a component imports from a sibling module. `from` names the source in
   the inlined comment. `owner` is a section whose own text already declares
   them, so index.d.ts never declares them twice. `names` is what a later
   section's pointer comment lists. */
const HELPERS = {
  Verdict: {
    from: 'VerdictBadge',
    owner: 'VerdictBadge',
    names: 'Verdict',
    verb: 'is',
    text: "export type Verdict = 'go' | 'no' | 'hold';",
  },
  TableHelpers: {
    from: 'table/core',
    names: 'ColumnDef, TableBaseProps and TableElementProps',
    verb: 'are',
    tanstack: ['RowData', 'CellData', 'ColumnDef as TanStackColumnDef', 'TableFeature'],
    text: [
      '/** The feature set both table components register (short form of `tableFeatureSet` in table/core: the row-model factories and sort functions are left out). */',
      'export type TableFeatureSet = {',
      '    columnFilteringFeature: TableFeature;',
      '    columnVisibilityFeature: TableFeature;',
      '    globalFilteringFeature: TableFeature;',
      '    rowPaginationFeature: TableFeature;',
      '    rowSortingFeature: TableFeature;',
      '};',
      '/** A `@tanstack/react-table` v9 column definition over that feature set. */',
      'export type ColumnDef<T extends RowData, TValue extends CellData = CellData> = TanStackColumnDef<TableFeatureSet, T, TValue>;',
      '/** Props both table components accept, minus the div attributes they forward. */',
      'export interface TableBaseProps<T extends RowData> {',
      '    data: T[];',
      '    columns: ColumnDef<T>[];',
      '    /** Title shown by the EmptyState row when there are no rows to display. */',
      '    emptyMessage?: string;',
      "    /** Shows a built-in global filter input above the table, wired to TanStack's filtered row model. */",
      '    filterable?: boolean;',
      '    /** Accessible label / placeholder for the built-in filter input. */',
      '    filterPlaceholder?: string;',
      '}',
      "export type TableElementProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;",
    ].join('\n'),
  },
};

/* HELPERS and ANCHORED_PICK restate parts of react's dist types. If one of
   these strings leaves its file, the restatement is stale and the build stops. */
export const RESTATED_FACTS = [
  {
    file: 'components/organisms/table/core.d.ts',
    update: 'HELPERS.TableHelpers',
    facts: [
      'emptyMessage?: string;',
      'filterable?: boolean;',
      'filterPlaceholder?: string;',
      "export type TableElementProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;",
      'TanStackColumnDef<TableFeatureSet, T, TValue>',
    ],
  },
  {
    file: 'components/molecules/VerdictBadge.d.ts',
    update: 'HELPERS.Verdict',
    facts: [HELPERS.Verdict.text],
  },
  {
    file: 'hooks/useAnchoredPosition.d.ts',
    update: 'ANCHORED_PICK',
    facts: ["type Side = 'top' | 'bottom';", "type Align = 'start' | 'center' | 'end';"],
  },
];

const ANCHORED_PICK = [
  '{',
  "    /** Which edge of the trigger the panel hangs from. Default `'bottom'`. */",
  "    side?: 'top' | 'bottom';",
  "    /** `'start'` (default) or `'end'` pins that edge of the panel to the trigger's and takes the trigger's width as a minimum; `'center'` centres it on the trigger. */",
  "    align?: 'start' | 'center' | 'end';",
  '}',
].join('\n');

/* What to do with each `import type { … } from '<specifier>'` in a dist .d.ts.
   A specifier not listed here fails the build: a new relative import needs a
   decision, not a silent drop. */
const IMPORT_RULES = {
  react: { collect: 'react' },
  '@tanstack/react-table': { collect: 'tanstack' },
  /* Virtualizer is the one name used, and the preamble adds it by name. */
  '@tanstack/react-virtual': {},
  './VerdictBadge.js': { helper: 'Verdict' },
  './table/core.js': { helper: 'TableHelpers' },
  './overlay/anchoredOverlay.js': {
    rewrite: ["Pick<AnchoredOverlayContentProps, 'side' | 'align'>", ANCHORED_PICK],
  },
};

function toInterfaces(text) {
  const source = ts.createSourceFile('x.d.ts', text, ts.ScriptTarget.Latest, true);
  const edits = [];
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || !/Props$/.test(statement.name.text)) continue;
    const members = ts.isIntersectionTypeNode(statement.type)
      ? statement.type.types
      : [statement.type];
    const refs = [];
    const bodies = [];
    let convertible = true;
    for (const member of members) {
      if (ts.isTypeReferenceNode(member)) refs.push(member.getText(source));
      else if (ts.isTypeLiteralNode(member)) {
        bodies.push(
          member
            .getText(source)
            .replace(/^\{\s*\n?/, '')
            .replace(/\s*\}$/, ''),
        );
      } else convertible = false;
    }
    if (!convertible) continue;
    const params = statement.typeParameters
      ? `<${statement.typeParameters.map((param) => param.getText(source)).join(', ')}>`
      : '';
    const modifiers = statement.modifiers
      ? `${statement.modifiers.map((modifier) => modifier.getText(source)).join(' ')} `
      : '';
    const body = bodies
      .filter((part) => part.trim())
      .map((part) => `    ${part.trim()}`)
      .join('\n');
    const replacement =
      `${modifiers}interface ${statement.name.text}${params}` +
      `${refs.length ? ` extends ${refs.join(', ')}` : ''} {${body ? `\n${body}\n` : ''}}`;
    edits.push([statement.getStart(source), statement.end, replacement]);
  }
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) {
    text = text.slice(0, start) + replacement + text.slice(end);
  }
  return text;
}

/** The `// ── Name` section of a previous index.d.ts. */
export function previousTypesSection(indexDts, name) {
  const match = new RegExp(`// ── ${name}\\n([\\s\\S]*?)(?=\\n// ── |$)`).exec(indexDts);
  if (!match) throw new Error(`previous index.d.ts has no section for ${name}`);
  return match[1].trim();
}

/**
 * One dist .d.ts made self-contained.
 *
 * @returns {{ text: string, helpers: string[], react: string[], tanstack: string[] }}
 */
export function selfContainedDts(source, name) {
  let text = source.replace(/^\/\/# sourceMappingURL=.*$/m, '');
  const out = { helpers: [], react: [], tanstack: [] };
  const IMPORT = /^import type \{([^}]+)\} from '([^']+)';$/;
  /* Every type import is removed below, so one in another form must fail here, not vanish. */
  for (const line of text.match(/^import type .*$/gm) ?? []) {
    if (!IMPORT.test(line)) throw new Error(`${name}.d.ts: no rule for the import form ${line}`);
  }
  for (const match of text.matchAll(new RegExp(IMPORT.source, 'gm'))) {
    const rule = IMPORT_RULES[match[2]];
    if (!rule) throw new Error(`${name}.d.ts: no rule for the import from ${match[2]}`);
    const names = match[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (rule.collect) out[rule.collect].push(...names);
    if (rule.helper) out.helpers.push(rule.helper);
    if (rule.rewrite) text = text.replace(...rule.rewrite);
  }
  text = text
    .replace(/^import type .*$\n/gm, '')
    .replace(/^export type \{[^}]*\} from .*$\n/gm, '');
  if (/AnchoredOverlay/.test(text)) throw new Error(`${name}.d.ts still names AnchoredOverlay`);
  text = text.replace(
    /export declare const (\w+): import\("react"\)\.ForwardRefExoticComponent<([\s\S]*?)>;\n/g,
    (all, component, inner) => {
      const ref = / & import\("react"\)\.RefAttributes<(\w+)>$/.exec(inner);
      return ref && new RegExp(`export type ${component}Props\\b`).test(text)
        ? `export declare const ${component}: React.ForwardRefExoticComponent<${component}Props & React.RefAttributes<${ref[1]}>>;\n`
        : all;
    },
  );
  text = text
    .replace(/import\("react"\)\./g, 'React.')
    .replace(/import\("react\/jsx-runtime"\)\.JSX\./g, 'React.JSX.');
  if (/import\(|from '\./.test(text)) throw new Error(`${name}.d.ts: an import is left`);
  return { ...out, text: toInterfaces(text).trim() };
}

/**
 * @param {object} options
 * @param {object} options.manifest      @elirobinson/react's dist/manifest.json
 * @param {string} options.reactDist     packages/react/dist
 * @param {string} options.previousIndexDts  the live artifact's components/index.d.ts
 * @returns {{ index: string, perComponent: Map<string, string> }}
 */
export function buildTypes({ manifest, reactDist, previousIndexDts }) {
  const read = (path) => readFileSync(join(reactDist, path), 'utf8');
  for (const { file, update, facts } of RESTATED_FACTS) {
    const text = read(file);
    for (const fact of facts) {
      if (!text.includes(fact)) throw new Error(`${file} changed; update ${update} (${fact})`);
    }
  }

  const sections = inArtifactOrder(
    manifest.components,
    (component) => ({
      name: component.name,
      ...selfContainedDts(read(`components/${component.subpath}.d.ts`), component.name),
    }),
    (name) => ({
      name,
      text: previousTypesSection(previousIndexDts, name),
      helpers: [],
      react: [],
      tanstack: [],
    }),
  );
  const reactNames = new Set(sections.flatMap((section) => section.react));
  const tanstackNames = new Set(sections.flatMap((section) => section.tanstack));

  const tanstackFor = (section) =>
    new Set([
      ...[...tanstackNames].filter((name) => new RegExp(`\\b${name}\\b`).test(section.text)),
      ...section.helpers.flatMap((helper) => HELPERS[helper].tanstack ?? []),
    ]);
  const preamble = (text, tanstack, virtualizer) => {
    const lines = ["import type * as React from 'react';"];
    const used = [...reactNames].filter((name) => new RegExp(`\\b${name}\\b`).test(text)).sort();
    if (used.length) lines.push(`import type { ${used.join(', ')} } from 'react';`);
    if (tanstack.size) {
      lines.push(
        `import type { ${[...tanstack].sort().join(', ')} } from '@tanstack/react-table';`,
      );
    }
    if (virtualizer) lines.push("import type { Virtualizer } from '@tanstack/react-virtual';");
    return lines.join('\n');
  };
  const inlined = (helper, label) =>
    `// (${label}, inlined from ${HELPERS[helper].from})\n${HELPERS[helper].text}\n`;

  /* index.d.ts declares each helper once. The first section that needs it
     inlines it, or points at its owner; every later one points at where it is. */
  const declaredIn = new Map();
  const indexBody = sections
    .map((section) => {
      let body = '';
      for (const helper of section.helpers) {
        const { owner, names, verb } = HELPERS[helper];
        const where = declaredIn.get(helper) ?? owner;
        if (where) body += `// ${names} ${verb} declared in the ${where} section.\n`;
        else body += inlined(helper, 'shared helper types');
        if (!declaredIn.has(helper)) declaredIn.set(helper, where ?? section.name);
      }
      return `// ── ${section.name}\n${body}${section.text}\n`;
    })
    .join('\n');
  const header =
    '// Miltinson Design System — component types, one section per component (from components/<Comp>/<Comp>.d.ts).\n' +
    `// Built from @elirobinson/react ${manifest.version} dist/components/**/*.d.ts (relative imports removed, helper types inlined); ${ARTIFACT_ONLY.names.join(' and ')} are artifact-only.\n`;
  const index = `${header}${preamble(indexBody, new Set(sections.flatMap((section) => [...tanstackFor(section)])), true)}\n\n${indexBody}`;
  for (const helper of new Set(sections.flatMap((section) => section.helpers))) {
    for (const [, declared] of HELPERS[helper].text.matchAll(
      /^export (?:type|interface) (\w+)/gm,
    )) {
      const count = (
        index.match(new RegExp(`^export (?:type|interface) ${declared}\\b`, 'gm')) ?? []
      ).length;
      if (count !== 1) throw new Error(`index.d.ts declares ${declared} ${count} times`);
    }
  }

  const perComponent = new Map();
  for (const section of sections) {
    const body =
      section.helpers.map((helper) => inlined(helper, 'helper types')).join('') +
      `${section.text}\n`;
    perComponent.set(
      section.name,
      `// Miltinson Design System — ${section.name} types.\n` +
        `${preamble(body, tanstackFor(section), /Virtualizer/.test(body))}\n\n// ── ${section.name}\n${body}`,
    );
  }
  return { index, perComponent };
}
