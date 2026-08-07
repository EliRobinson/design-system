/* Build-time extraction over packages/react/src. Emits
   src/generated/component-manifest.json — the single source for the docs
   props tables, the site search index, and the AI artifacts (llms.txt,
   llms-full.txt, /r/[component].json). Nothing downstream may keep a second
   copy of this data. */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withCustomConfig } from 'react-docgen-typescript';
import type { ComponentDoc } from 'react-docgen-typescript';

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(docsRoot, '../..');
const reactSrc = join(repoRoot, 'packages/react/src');
const componentsDir = join(reactSrc, 'components');
const hooksDir = join(reactSrc, 'hooks');
const outFile = join(docsRoot, 'src/generated/component-manifest.json');

const TIERS = ['atoms', 'molecules', 'organisms'] as const;
type Tier = (typeof TIERS)[number];

type PropRecord = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
};

type SubComponentRecord = {
  name: string;
  description: string;
  inherits: string | null;
  props: PropRecord[];
};

type ComponentRecord = {
  name: string;
  slug: string;
  tier: Tier;
  importPath: string;
  stylesheetPaths: string[];
  description: string;
  inherits: string | null;
  props: PropRecord[];
  subComponents: SubComponentRecord[];
  hooks: { name: string; description: string }[];
  exportedTypes: string[];
  constraints: string[];
  extractionGaps: string[];
};

type HookRecord = {
  name: string;
  importPath: string;
  description: string;
};

/* Components whose styles live in a shared or misplaced sheet rather than a
   sibling <Name>.css. Pipeline config, not documentation content. */
const SHARED_STYLESHEETS: Record<string, { path: string; gap?: string }> = {
  Input: { path: 'atoms/field.css' },
  Textarea: { path: 'atoms/field.css' },
  Select: { path: 'atoms/field.css' },
  Label: { path: 'atoms/field.css' },
  RadioGroup: {
    path: 'molecules/RuleLink.css',
    gap: 'ds-radio-group styles are defined in molecules/RuleLink.css, not a RadioGroup sheet',
  },
};

/* Touch-target scoping from docs/agents/components.md — constraint ids
   resolve against packages/ai-patterns/src/contracts.json. */
const PRIMARY_CONTROLS = new Set(['Button', 'Pagination', 'SegmentedControl', 'NavigationMenu']);
const DENSE_AFFORDANCES = new Set(['Chip', 'SearchField', 'Rating', 'DatePicker']);

const curated: Record<string, unknown> = JSON.parse(
  readFileSync(join(docsRoot, 'scripts/component-descriptions.json'), 'utf8'),
);
const descriptions = curated as unknown as Record<string, string>;
const hookDescriptions = (curated.hooks ?? {}) as Record<string, string>;

const parser = withCustomConfig(join(repoRoot, 'packages/react/tsconfig.json'), {
  shouldExtractLiteralValuesFromEnum: true,
  shouldRemoveUndefinedFromOptional: true,
  savePropValueAsString: true,
  propFilter: (prop) => {
    if (prop.declarations && prop.declarations.length > 0) {
      return prop.declarations.some((d) => !d.fileName.includes('node_modules'));
    }
    return true;
  },
});

function toSlug(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function cleanJsDoc(block: string): string {
  return block
    .split('\n')
    .map((line) => line.replace(/^\s*\*? ?/, ''))
    .join('\n')
    .trim();
}

/* docgen reports literal unions as name "enum" with the members in
   type.value — render the union itself, which is what a reader needs. */
function displayType(type: ComponentDoc['props'][string]['type']): string {
  if (type.name === 'enum' && Array.isArray(type.value)) {
    return type.value.map((v: { value: string }) => v.value).join(' | ');
  }
  return type.name;
}

function toPropRecords(doc: ComponentDoc): PropRecord[] {
  return Object.values(doc.props)
    .filter((prop) => prop.name !== 'ref' && prop.name !== 'key')
    .map((prop) => ({
      name: prop.name,
      type: displayType(prop.type),
      required: prop.required,
      defaultValue:
        prop.defaultValue && prop.defaultValue.value != null
          ? String(prop.defaultValue.value)
          : null,
      description: prop.description ?? '',
    }))
    .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));
}

/* "type XProps = ButtonHTMLAttributes<HTMLButtonElement> & {…}" → the base the
   props table doesn't repeat. Handles Omit<…> bases (possibly multi-line);
   bails if the captured "base" is actually an object literal. */
function findInherits(source: string, componentName: string): string | null {
  const intersection = new RegExp(`type ${componentName}Props =\\s*([\\s\\S]{1,200}?)\\s*&\\s*\\{`);
  const direct = new RegExp(`type ${componentName}Props =\\s*([A-Za-z]+<[^;]+>);`);
  const match = source.match(intersection) ?? source.match(direct);
  if (!match) {
    return null;
  }
  const base = match[1].replace(/\s+/g, ' ').replace(/< /g, '<').replace(/ >/g, '>').trim();
  return base.includes('{') ? null : base;
}

function findExportedTypes(source: string): string[] {
  return [...source.matchAll(/^export (?:type|interface) (\w+)/gm)].map((m) => m[1]);
}

/* The (?:(?!\*\/)…) guard keeps the match from crossing a comment boundary,
   so only the JSDoc block immediately above the export is captured. */
const JSDOC_BLOCK = String.raw`\/\*\*((?:(?!\*\/)[\s\S])*)\*\/`;

function findFileHooks(source: string): { name: string; description: string }[] {
  return [
    ...source.matchAll(new RegExp(`(?:${JSDOC_BLOCK}\\s*)?export function (use\\w+)`, 'g')),
  ].map((m) => ({ name: m[2], description: m[1] ? cleanJsDoc(m[1]) : '' }));
}

function stylesheetsFor(
  tier: Tier,
  name: string,
  source: string,
): { paths: string[]; gaps: string[] } {
  const paths = new Set<string>();
  const gaps: string[] = [];
  const sibling = join(componentsDir, tier, `${name}.css`);
  if (existsSync(sibling)) {
    paths.add(`@elirobinson/react/styles/${tier}/${name}.css`);
  }
  /* A relatively imported module with its own sibling sheet (e.g. Table →
     ./table/core with table/core.css) is part of this component's styles. */
  for (const rel of source.matchAll(/from '(\.\/[\w/-]+)'/g)) {
    const css = join(componentsDir, tier, `${rel[1]}.css`);
    if (existsSync(css)) {
      paths.add(`@elirobinson/react/styles/${tier}/${rel[1].slice(2)}.css`);
    }
  }
  const shared = SHARED_STYLESHEETS[name];
  if (shared) {
    paths.add(`@elirobinson/react/styles/${shared.path}`);
    if (shared.gap) {
      gaps.push(shared.gap);
    }
  }
  return { paths: [...paths], gaps };
}

function constraintsFor(name: string, source: string): string[] {
  const ids = ['no-barrel-imports'];
  if (source.includes('forwardRef')) {
    ids.push('forward-ref');
  }
  if (PRIMARY_CONTROLS.has(name)) {
    ids.push('touch-target-primary', 'hit-area-no-overlap');
  }
  if (DENSE_AFFORDANCES.has(name)) {
    ids.push('touch-target-dense', 'hit-area-no-overlap');
  }
  return ids;
}

function extractComponent(tier: Tier, file: string): ComponentRecord {
  const name = basename(file, '.tsx');
  const source = readFileSync(file, 'utf8');
  const docs = parser.parse(file);
  const gaps: string[] = [];

  let primary = docs.find((d) => d.displayName === name);
  if (!primary) {
    primary = docs[0];
    if (primary) {
      gaps.push(
        `no export named ${name}; using first parsed component ${primary.displayName} as primary`,
      );
    } else {
      gaps.push('react-docgen-typescript found no components in this file');
    }
  }

  const subDocs = docs.filter((d) => d !== primary);
  const { paths: stylesheetPaths, gaps: styleGaps } = stylesheetsFor(tier, name, source);
  gaps.push(...styleGaps);

  const description = (primary?.description || '').trim() || descriptions[name] || '';
  if (!description) {
    gaps.push('no description available from source JSDoc or curated list');
  }

  return {
    name,
    slug: toSlug(name),
    tier,
    importPath: `@elirobinson/react/components/${tier}/${name}`,
    stylesheetPaths,
    description,
    inherits: findInherits(source, name),
    props: primary ? toPropRecords(primary) : [],
    subComponents: subDocs.map((d) => ({
      name: d.displayName,
      description: (d.description || '').trim(),
      inherits: findInherits(source, d.displayName),
      props: toPropRecords(d),
    })),
    hooks: findFileHooks(source),
    exportedTypes: findExportedTypes(source),
    constraints: constraintsFor(name, source),
    extractionGaps: gaps,
  };
}

function extractHooks(): HookRecord[] {
  return readdirSync(hooksDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => {
      const name = basename(f, '.ts');
      const source = readFileSync(join(hooksDir, f), 'utf8');
      const match = source.match(new RegExp(`${JSDOC_BLOCK}\\s*export function ${name}`));
      return {
        name,
        importPath: `@elirobinson/react/hooks/${name}`,
        description: match ? cleanJsDoc(match[1]) : (hookDescriptions[name] ?? ''),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const components: ComponentRecord[] = [];
for (const tier of TIERS) {
  const files = readdirSync(join(componentsDir, tier))
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .sort();
  for (const file of files) {
    components.push(extractComponent(tier, join(componentsDir, tier, file)));
  }
}

const manifest = {
  $comment:
    'Generated by apps/docs/scripts/extract-manifest.mts — do not edit by hand. Regenerated on every docs dev/build.',
  generatedFrom: 'packages/react/src',
  components,
  hooks: extractHooks(),
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(
  `component-manifest.json: ${components.length} components, ${manifest.hooks.length} hooks\n`,
);

const withGaps = components.filter((c) => c.extractionGaps.length > 0);
if (withGaps.length > 0) {
  process.stdout.write(`extraction gaps recorded for: ${withGaps.map((c) => c.name).join(', ')}\n`);
}
