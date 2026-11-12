// Builds the machine-readable inventory of what this package exports.
//
// This is the *only* extractor. dist/manifest.json is generated from it at
// build time (see generate-manifest.mjs) and published as
// `@elirobinson/react/manifest`; the `ds` CLI, the docs site, and the
// ai-patterns llms snapshot all read that one file. Nothing downstream may
// keep a second copy of this data or grow a second walk over src/components.
//
// Discovery is layout-agnostic on purpose: components are found by walking
// src/components, and the tier is whatever directory segments sit between that
// root and the file. A flat layout yields tier: null and still works — the
// package went from 24 flat components to 45 across atoms/molecules/organisms
// without an edit here, and it must keep surviving that.
//
// Two layers produce a record, and they degrade independently:
//
//   source-analysis.mjs  ts.createSourceFile, no type checker. Exports, the
//                        props type name, literal-union variants, the base
//                        type the props extend, declared hooks. Always available.
//   prop-docs.mjs        react-docgen-typescript over a resolved program. Full
//                        prop tables, descriptions, compound sub-components.
//                        A file it cannot parse records an extractionGap and
//                        still gets everything from the layer above.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseComponentDocs, toPropRecords } from './prop-docs.mjs';
import { analyzeSource, inheritsOf, variantsFor } from './source-analysis.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));

/* Components whose styles live in a shared or misplaced sheet rather than a
   sibling <Name>.css. Pipeline config, not documentation content: paths are
   relative to src/components, and one that stops resolving records a gap
   rather than publishing a stylesheet path that 404s. */
const SHARED_STYLESHEETS = {
  Input: { path: 'atoms/field.css' },
  Textarea: { path: 'atoms/field.css' },
  Select: { path: 'atoms/field.css' },
  Label: { path: 'atoms/field.css' },
  /* Their sibling sheet draws the row; field.css supplies the error message
     (.ds-hint--error) and the hideLabel rule (.ds-visually-hidden). */
  Checkbox: { path: 'atoms/field.css' },
  Switch: { path: 'atoms/field.css' },
  /* No sheet of its own: it is the .ds-hint--error message. */
  FieldError: { path: 'atoms/field.css' },
  RadioGroup: {
    path: 'molecules/RuleLink.css',
    gap: 'ds-radio-group styles are defined in molecules/RuleLink.css, not a RadioGroup sheet',
  },
};

/* Touch-target scoping from docs/agents/components.md — constraint ids
   resolve against packages/ai-patterns/src/contracts.json. */
const PRIMARY_CONTROLS = new Set(['Button', 'Pagination', 'SegmentedControl', 'NavigationMenu']);
const DENSE_AFFORDANCES = new Set(['Chip', 'SearchField', 'Rating', 'DatePicker']);

/* Fallback one-liners for components and hooks whose source carries no JSDoc.
   Every entry is debt: the description belongs on the declaration, where it
   cannot drift. A component with neither records an extractionGap. */
const curated = JSON.parse(readFileSync(join(scriptsDir, 'component-descriptions.json'), 'utf8'));
const curatedHooks = curated.hooks ?? {};

/** Source files that are implementation, not tests or fixtures. */
function sourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

/** 'components/atoms/Button.tsx' -> 'atoms/Button' (POSIX separators). */
function subpathOf(root, path) {
  return relative(root, path)
    .replace(/\.tsx?$/, '')
    .split(sep)
    .join('/');
}

/** A module's public name is its file's: 'organisms/Dialog' -> 'Dialog'. */
const moduleName = (subpath) => subpath.split('/').at(-1);

/** 'SegmentedControl' -> 'segmented-control'. */
function toSlug(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Every stylesheet that dresses a component: the sibling <Name>.css, the sheet
 * belonging to any relatively-imported module (Table -> ./table/core with
 * table/core.css), and any shared sheet declared above.
 */
function stylesheetsFor(componentsDir, packageName, subpath, relativeImports) {
  const dir = dirname(subpath);
  const prefix = (sheet) => `${packageName}/styles/${sheet}`;
  const beside = (sheet) => (dir === '.' ? sheet : `${dir}/${sheet}`);

  const paths = new Set();
  const gaps = [];

  const sibling = `${subpath}.css`;
  if (existsSync(join(componentsDir, sibling))) paths.add(prefix(sibling));

  for (const specifier of relativeImports) {
    const sheet = beside(`${specifier.slice(2)}.css`);
    if (existsSync(join(componentsDir, sheet))) paths.add(prefix(sheet));
  }

  const shared = SHARED_STYLESHEETS[moduleName(subpath)];
  if (shared) {
    if (existsSync(join(componentsDir, shared.path))) paths.add(prefix(shared.path));
    else gaps.push(`shared stylesheet ${shared.path} is declared but does not exist`);
    if (shared.gap) gaps.push(shared.gap);
  }

  return { paths: [...paths], gaps };
}

const renderLiteral = (value) => (typeof value === 'string' ? `"${value}"` : String(value));

const sameMembers = (a, b) => {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
};

/**
 * The type checker orders union members by an internal type id, so which file
 * happened to be compiled first decides whether a prop reads `1 | 2 | 3` or
 * `3 | 1 | 2`. Where the source spells the union out, publish it in the order
 * it was written — but only when both agree on the members, so this stays a
 * reordering and never a rewrite.
 */
function inSourceUnionOrder(props, variants) {
  const byProp = new Map(variants.map((variant) => [variant.prop, variant]));

  return props.map((prop) => {
    const variant = byProp.get(prop.name);
    if (!variant) return prop;
    const values = variant.values.map(renderLiteral);
    return sameMembers(values, prop.type.split(' | '))
      ? { ...prop, type: values.join(' | ') }
      : prop;
  });
}

function constraintsFor(name, source) {
  const ids = ['no-barrel-imports'];
  if (source.includes('forwardRef')) ids.push('forward-ref');
  if (PRIMARY_CONTROLS.has(name)) ids.push('touch-target-primary', 'hit-area-no-overlap');
  if (DENSE_AFFORDANCES.has(name)) ids.push('touch-target-dense', 'hit-area-no-overlap');
  return ids;
}

function componentEntry(componentsDir, packageName, { subpath, analysis }, docs) {
  const segments = subpath.split('/');
  const name = moduleName(subpath);

  const { text, values, types, declarations, hooks, relativeImports } = analysis;
  const propsType = types.includes(`${name}Props`) ? `${name}Props` : null;
  const importSpecifier = `${packageName}/components/${subpath}`;

  const gaps = [];
  const primary = docs.find((doc) => doc.displayName === name) ?? null;
  if (!primary) gaps.push('react-docgen-typescript found no component named after this file');

  const { paths: stylesheetPaths, gaps: styleGaps } = stylesheetsFor(
    componentsDir,
    packageName,
    subpath,
    relativeImports,
  );
  gaps.push(...styleGaps);

  const description = (primary?.description ?? '').trim() || curated[name] || '';
  if (!description) gaps.push('no description available from source JSDoc or curated list');

  const variants = propsType ? variantsFor(analysis, propsType) : [];

  return {
    name,
    slug: toSlug(name),
    tier: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
    subpath,
    importSpecifier,
    stylesheetPaths,
    description,
    inherits: propsType ? inheritsOf(declarations, propsType) : null,
    exports: values,
    types,
    propsType,
    variants,
    props: primary ? inSourceUnionOrder(toPropRecords(primary), variants) : [],
    subComponents: docs
      .filter((doc) => doc !== primary)
      .map((doc) => {
        const subProps = `${doc.displayName}Props`;
        return {
          name: doc.displayName,
          description: (doc.description ?? '').trim(),
          inherits: inheritsOf(declarations, subProps),
          props: inSourceUnionOrder(toPropRecords(doc), variantsFor(analysis, subProps)),
        };
      }),
    hooks,
    constraints: constraintsFor(name, text),
    extractionGaps: gaps,
  };
}

function hookEntry(packageName, { subpath, analysis }, usedBy) {
  const name = moduleName(subpath);
  const { values, types, hooks } = analysis;
  const importSpecifier = `${packageName}/hooks/${subpath}`;

  return {
    name,
    subpath,
    importSpecifier,
    description: hooks.find((hook) => hook.name === name)?.description || curatedHooks[name] || '',
    exports: values,
    types,
    usedBy,
  };
}

/** The parsed modules under `root`, sorted by module subpath. */
function modulesUnder(root, analyses) {
  return [...analyses]
    .filter(([path]) => path.startsWith(root + sep))
    .map(([path, analysis]) => ({ path, subpath: subpathOf(root, path), analysis }))
    .sort((a, b) => a.subpath.localeCompare(b.subpath));
}

/**
 * Who uses a module, by name: the components and hooks that import it, read
 * off the import graph of src/ so the answer cannot drift from the code.
 *
 * Only components and hooks are named, because they are the only modules a
 * reader can look up. An internal module in between (organisms/overlay/*,
 * lib/*) is looked through to whoever imports it: useDisclosure is imported by
 * overlay/anchoredOverlay and overlay/modalSurface, and reports Popover,
 * DropdownMenu, Dialog and Sheet, which is where it reaches a consumer.
 *
 * @param {Map<string, { valueImports: string[] }>} analyses every module in src/, by path
 * @param {Map<string, string>} named path -> public name, for components and hooks
 * @returns {(path: string) => string[]} sorted names, without duplicates
 */
function usersByImport(analyses, named) {
  const importers = new Map();
  for (const [path, analysis] of analyses) {
    for (const target of analysis.valueImports) {
      if (!importers.has(target)) importers.set(target, []);
      importers.get(target).push(path);
    }
  }

  return (path) => {
    const names = new Set();
    const seen = new Set([path]);
    const queue = [path];
    while (queue.length > 0) {
      for (const importer of importers.get(queue.shift()) ?? []) {
        if (seen.has(importer)) continue;
        seen.add(importer);
        if (named.has(importer)) names.add(named.get(importer));
        else queue.push(importer);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  };
}

/**
 * A file describes a component when it exports a value named after itself.
 * `Button.tsx` exports `Button`; `table/core.tsx` exports helpers that `Table`
 * and `VirtualTable` share and is not itself importable as a component. The
 * rule is structural rather than a list of names, so it holds under any layout.
 */
function isComponent({ subpath, analysis }) {
  return analysis.values.includes(moduleName(subpath));
}

/**
 * @param {string} packageRoot directory holding package.json and src/
 * @returns the manifest object written to dist/manifest.json
 */
export function buildManifest(packageRoot) {
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  const srcDir = join(packageRoot, 'src');
  const componentsDir = join(srcDir, 'components');

  // Every file in src/, parsed once: components and hooks are read from it,
  // and so is the import graph that names each hook's users.
  const analyses = new Map(sourceFiles(srcDir).map((path) => [path, analyzeSource(path)]));

  const modules = modulesUnder(componentsDir, analyses).filter(isComponent);
  const hookModules = modulesUnder(join(srcDir, 'hooks'), analyses).filter(
    (module) => module.analysis.values.length > 0,
  );
  const docsByFile = parseComponentDocs(
    modules.map((module) => module.path),
    join(packageRoot, 'tsconfig.json'),
  );

  const components = modules.map((module) =>
    componentEntry(componentsDir, pkg.name, module, docsByFile.get(module.path) ?? []),
  );

  const named = new Map(
    [...modules, ...hookModules].map((module) => [module.path, moduleName(module.subpath)]),
  );
  const usedBy = usersByImport(analyses, named);
  const hooks = hookModules.map((module) => hookEntry(pkg.name, module, usedBy(module.path)));

  return {
    // Bump when the manifest's own shape changes, so readers can degrade.
    manifestVersion: 3,
    package: pkg.name,
    version: pkg.version,
    tiers: [...new Set(components.map((entry) => entry.tier).filter(Boolean))].sort(),
    components,
    hooks,
  };
}
