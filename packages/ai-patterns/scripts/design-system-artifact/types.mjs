/* components/index.d.ts and components/<Comp>/<Comp>.d.ts for the Claude
 * "Design System" artifact.
 *
 * The artifact reads props from `<Comp>Props` in index.d.ts and shows them on
 * its api cards. These files are documentation: nothing type-checks them. So
 * each component's dist .d.ts is made self-contained: relative imports are
 * removed, the few shared helper types are inlined, and `type XProps = A & {…}`
 * becomes an interface the card can read.
 *
 * ChatComposer and PromptSuggestions exist only in the artifact. Their
 * sections are read back from its previous index.d.ts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

import { ARTIFACT_ONLY_COMPONENTS } from './bundle.mjs';

const ARTIFACT_ONLY_AFTER = 'StreamingCaret';

const HELPERS = {
  Verdict: { from: 'VerdictBadge', text: "export type Verdict = 'go' | 'no' | 'hold';" },
  TableHelpers: {
    from: 'table/core',
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

/* The inlined table helpers restate parts of table/core.d.ts. If these
   strings leave it, the restatement is stale. */
const TABLE_CORE_FACTS = [
  'emptyMessage?: string;',
  'filterable?: boolean;',
  'filterPlaceholder?: string;',
  "export type TableElementProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;",
  'TanStackColumnDef<TableFeatureSet, T, TValue>',
];

const ANCHORED_PICK = [
  '{',
  "    /** Which edge of the trigger the panel hangs from. Default `'bottom'`. */",
  "    side?: 'top' | 'bottom';",
  "    /** `'start'` (default) or `'end'` pins that edge of the panel to the trigger's and takes the trigger's width as a minimum; `'center'` centres it on the trigger. */",
  "    align?: 'start' | 'center' | 'end';",
  '}',
].join('\n');

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
 * @param {object} options
 * @param {object} options.manifest      @elirobinson/react's dist/manifest.json
 * @param {string} options.reactDist     packages/react/dist
 * @param {string} options.previousIndexDts  the live artifact's components/index.d.ts
 * @returns {{ index: string, perComponent: Map<string, string> }}
 */
export function buildTypes({ manifest, reactDist, previousIndexDts }) {
  const read = (path) => readFileSync(join(reactDist, path), 'utf8');
  const core = read('components/organisms/table/core.d.ts');
  for (const fact of TABLE_CORE_FACTS) {
    if (!core.includes(fact))
      throw new Error(`table/core.d.ts changed; update HELPERS.TableHelpers (${fact})`);
  }

  const sections = [];
  const reactNames = new Set();
  const tanstackNames = new Set();
  for (const component of manifest.components) {
    let text = read(`components/${component.subpath}.d.ts`).replace(
      /^\/\/# sourceMappingURL=.*$/m,
      '',
    );
    const helpers = [];
    for (const match of text.matchAll(/^import type \{([^}]+)\} from '([^']+)';$/gm)) {
      const names = match[1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      const from = match[2];
      if (from === 'react') names.forEach((name) => reactNames.add(name));
      else if (from === '@tanstack/react-table') names.forEach((name) => tanstackNames.add(name));
      else if (from === '@tanstack/react-virtual') continue;
      else if (from === './VerdictBadge.js') helpers.push('Verdict');
      else if (from === './table/core.js') helpers.push('TableHelpers');
      else if (from === './overlay/anchoredOverlay.js') {
        text = text.replace("Pick<AnchoredOverlayContentProps, 'side' | 'align'>", ANCHORED_PICK);
      } else throw new Error(`${component.name}.d.ts: no rule for the import from ${from}`);
    }
    text = text
      .replace(/^import type .*$\n/gm, '')
      .replace(/^export type \{[^}]*\} from .*$\n/gm, '');
    if (/AnchoredOverlay/.test(text))
      throw new Error(`${component.name}.d.ts still names AnchoredOverlay`);
    text = text.replace(
      /export declare const (\w+): import\("react"\)\.ForwardRefExoticComponent<([\s\S]*?)>;\n/g,
      (all, name, inner) => {
        const ref = / & import\("react"\)\.RefAttributes<(\w+)>$/.exec(inner);
        return ref && new RegExp(`export type ${name}Props\\b`).test(text)
          ? `export declare const ${name}: React.ForwardRefExoticComponent<${name}Props & React.RefAttributes<${ref[1]}>>;\n`
          : all;
      },
    );
    text = text
      .replace(/import\("react"\)\./g, 'React.')
      .replace(/import\("react\/jsx-runtime"\)\.JSX\./g, 'React.JSX.');
    if (/import\(|from '\./.test(text))
      throw new Error(`${component.name}.d.ts: an import is left`);
    sections.push({ name: component.name, text: toInterfaces(text).trim(), helpers });
    if (component.name === ARTIFACT_ONLY_AFTER) {
      for (const name of ARTIFACT_ONLY_COMPONENTS) {
        sections.push({ name, text: previousTypesSection(previousIndexDts, name), helpers: [] });
      }
    }
  }

  const tanstackFor = (section) => {
    const names = new Set(
      [...tanstackNames].filter((name) => new RegExp(`\\b${name}\\b`).test(section.text)),
    );
    if (section.helpers.includes('TableHelpers')) {
      ['RowData', 'CellData', 'ColumnDef as TanStackColumnDef', 'TableFeature'].forEach((name) =>
        names.add(name),
      );
    }
    return names;
  };
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
  const helperComment = (helper) => (helper === 'Verdict' ? 'VerdictBadge' : HELPERS[helper].from);

  /* index.d.ts: each helper once, in the first section that needs it. */
  const emitted = new Set();
  const allTanstack = new Set();
  for (const section of sections) tanstackFor(section).forEach((name) => allTanstack.add(name));
  const indexSections = sections.map((section) => {
    let body = '';
    for (const helper of section.helpers) {
      if (emitted.has(helper)) continue;
      emitted.add(helper);
      body += `// (shared helper types, inlined from ${helperComment(helper)})\n${HELPERS[helper].text}\n`;
    }
    if (section.name === 'VerdictBadge') emitted.add('Verdict');
    if (section.name === 'VirtualTable') {
      body +=
        '// ColumnDef, TableBaseProps and TableElementProps are declared in the Table section.\n';
    }
    /* DecisionCard comes before VerdictBadge, whose own text declares Verdict. */
    if (section.name === 'DecisionCard') {
      body = body.replace(
        `// (shared helper types, inlined from VerdictBadge)\n${HELPERS.Verdict.text}\n`,
        '// Verdict is declared in the VerdictBadge section.\n',
      );
    }
    return `// ── ${section.name}\n${body}${section.text}\n`;
  });
  const indexBody = indexSections.join('\n');
  const reactVersion = manifest.version;
  const header =
    '// Miltinson Design System — component types, one section per component (from components/<Comp>/<Comp>.d.ts).\n' +
    `// Built from @elirobinson/react ${reactVersion} dist/components/**/*.d.ts (relative imports removed, helper types inlined); ChatComposer and PromptSuggestions are artifact-only.\n`;
  const index = `${header}${preamble(indexBody, allTanstack, true)}\n\n${indexBody}`;
  const declarations = (index.match(/export type Verdict =/g) ?? []).length;
  if (declarations !== 1) throw new Error(`index.d.ts declares Verdict ${declarations} times`);

  const perComponent = new Map();
  for (const section of sections) {
    const body =
      section.helpers
        .map(
          (helper) =>
            `// (helper types, inlined from ${helperComment(helper)})\n${HELPERS[helper].text}\n`,
        )
        .join('') + `${section.text}\n`;
    const own = `// Miltinson Design System — ${section.name} types.\n`;
    perComponent.set(
      section.name,
      `${own}${preamble(body, tanstackFor(section), /Virtualizer/.test(body))}\n\n// ── ${section.name}\n${body}`,
    );
  }
  return { index, perComponent };
}
