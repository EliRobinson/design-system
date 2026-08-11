// Builds the machine-readable inventory of what this package exports.
// dist/manifest.json is generated from this at build time (see
// generate-manifest.mjs); tooling reads the JSON rather than regex-parsing
// emitted .d.ts, which is brittle against any change in how TypeScript emits
// declarations.
//
// Discovery is layout-agnostic on purpose: components are found by walking
// src/components, and the tier is whatever directory segments sit between that
// root and the file. A flat layout yields tier: null and still works.
//
// Analysis is syntactic (ts.createSourceFile, no type checker) so it stays fast
// and needs no resolved program. That is enough for what the manifest claims:
// exported value names, the props type name, and unions of literal types.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import ts from 'typescript';

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

function isExported(node) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
}

/** Literal union -> its values. Anything else -> null. */
function literalUnionValues(typeNode) {
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) return null;

  const values = typeNode.types.map((member) => {
    if (!ts.isLiteralTypeNode(member)) return undefined;
    const { literal } = member;
    if (ts.isStringLiteral(literal)) return literal.text;
    if (ts.isNumericLiteral(literal)) return Number(literal.text);
    return undefined;
  });

  return values.every((value) => value !== undefined) ? values : null;
}

/** Property signatures of a type node, following intersections and aliases. */
function propertySignatures(typeNode, aliases, seen = new Set()) {
  if (!typeNode) return [];

  if (ts.isIntersectionTypeNode(typeNode)) {
    return typeNode.types.flatMap((member) => propertySignatures(member, aliases, seen));
  }

  // A named alias standing in for the shape, e.g. `type XProps = YProps`.
  if (ts.isTypeReferenceNode(typeNode)) {
    const name = typeNode.typeName.getText();
    if (seen.has(name)) return [];
    seen.add(name);
    const alias = aliases.get(name);
    return alias ? propertySignatures(alias.type, aliases, seen) : [];
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members.filter(ts.isPropertySignature);
  }

  return [];
}

/**
 * Variant-shaped props: any prop whose type is a union of literals, whether
 * written inline (`size?: 'sm' | 'md'`) or behind an exported alias
 * (`variant?: ButtonVariant`). The alias name is reported when there is one so
 * consumers can import the union type itself.
 */
function variantsOf(propsTypeNode, aliases) {
  const variants = [];

  for (const property of propertySignatures(propsTypeNode, aliases)) {
    const name = property.name.getText().replace(/^['"]|['"]$/g, '');
    const typeNode = property.type;
    if (!typeNode) continue;

    const inline = literalUnionValues(typeNode);
    if (inline) {
      variants.push({ prop: name, type: null, values: inline });
      continue;
    }

    if (ts.isTypeReferenceNode(typeNode)) {
      const aliasName = typeNode.typeName.getText();
      const values = literalUnionValues(aliases.get(aliasName)?.type);
      if (values) variants.push({ prop: name, type: aliasName, values });
    }
  }

  return variants;
}

function analyze(path) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const values = [];
  const types = [];
  const aliases = new Map();

  for (const statement of source.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      aliases.set(statement.name.text, statement);
      if (isExported(statement)) types.push(statement.name.text);
      continue;
    }

    if (ts.isInterfaceDeclaration(statement) && isExported(statement)) {
      types.push(statement.name.text);
      continue;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement)) {
      values.push(statement.name.text);
      continue;
    }

    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) values.push(declaration.name.text);
      }
      continue;
    }

    // `export type { ColumnDef } from './table/core'` and friends.
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          (statement.isTypeOnly || element.isTypeOnly ? types : values).push(element.name.text);
        }
      }
    }
  }

  return { values, types, aliases };
}

function componentEntry(componentsDir, packageName, path) {
  const subpath = subpathOf(componentsDir, path);
  const segments = subpath.split('/');
  const name = segments.at(-1);

  const { values, types, aliases } = analyze(path);
  const propsType = types.includes(`${name}Props`) ? `${name}Props` : null;

  return {
    name,
    tier: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
    subpath,
    importSpecifier: `${packageName}/components/${subpath}`,
    exports: values,
    types,
    propsType,
    variants: propsType ? variantsOf(aliases.get(propsType)?.type, aliases) : [],
  };
}

function hookEntry(hooksDir, packageName, path) {
  const subpath = subpathOf(hooksDir, path);
  const { values, types } = analyze(path);

  return {
    name: subpath.split('/').at(-1),
    subpath,
    importSpecifier: `${packageName}/hooks/${subpath}`,
    exports: values,
    types,
  };
}

/**
 * @param {string} packageRoot directory holding package.json and src/
 * @returns the manifest object written to dist/manifest.json
 */
export function buildManifest(packageRoot) {
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  const srcDir = join(packageRoot, 'src');
  const componentsDir = join(srcDir, 'components');
  const hooksDir = join(srcDir, 'hooks');

  const components = sourceFiles(componentsDir)
    .map((path) => componentEntry(componentsDir, pkg.name, path))
    // Internal building blocks export no values worth importing on their own.
    .filter((entry) => entry.exports.length > 0)
    .sort((a, b) => a.subpath.localeCompare(b.subpath));

  const hooks = sourceFiles(hooksDir)
    .map((path) => hookEntry(hooksDir, pkg.name, path))
    .filter((entry) => entry.exports.length > 0)
    .sort((a, b) => a.subpath.localeCompare(b.subpath));

  return {
    // Bump when the manifest's own shape changes, so readers can degrade.
    manifestVersion: 1,
    package: pkg.name,
    version: pkg.version,
    tiers: [...new Set(components.map((entry) => entry.tier).filter(Boolean))].sort(),
    components,
    hooks,
  };
}
