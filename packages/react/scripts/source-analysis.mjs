// Syntactic analysis of one source file, via ts.createSourceFile.
//
// No type checker and no resolved program, so this is fast, needs no tsconfig,
// and works on a file in isolation — including a throwaway fixture directory.
// It answers only what is visible in the text of the file: what the file
// exports, which props are literal unions, what base type the props extend,
// which hooks it declares, and which sibling modules it imports.
//
// Anything that needs resolved types — a full prop table with inherited DOM
// attributes, defaults, and per-prop JSDoc — comes from prop-docs.mjs instead.

import { readFileSync } from 'node:fs';

import ts from 'typescript';

function isExported(node) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
}

/** The leading JSDoc description of a declaration, or ''. */
function jsDocDescription(node) {
  for (const doc of ts.getJSDocCommentsAndTags(node)) {
    if (!ts.isJSDoc(doc)) continue;
    const text = ts.getTextOfJSDocComment(doc.comment);
    if (text) return text.trim();
  }
  return '';
}

/** Collapse the whitespace a multi-line type reference carries in source. */
function typeText(node) {
  return node.getText().replace(/\s+/g, ' ').replace(/<\s+/g, '<').replace(/\s+>/g, '>').trim();
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

function heritageTypes(declaration) {
  return (declaration.heritageClauses ?? []).flatMap((clause) => clause.types);
}

function intersectionMembers(typeNode) {
  if (!typeNode) return [];
  return ts.isIntersectionTypeNode(typeNode) ? [...typeNode.types] : [typeNode];
}

/** Property signatures of a named type, following intersections and aliases. */
function signaturesOfName(name, declarations, seen) {
  if (seen.has(name)) return [];
  seen.add(name);

  const declaration = declarations.get(name);
  if (!declaration) return [];

  if (ts.isInterfaceDeclaration(declaration)) {
    return [
      ...declaration.members.filter(ts.isPropertySignature),
      ...heritageTypes(declaration).flatMap((base) => signaturesOf(base, declarations, seen)),
    ];
  }

  return signaturesOf(declaration.type, declarations, seen);
}

function signaturesOf(typeNode, declarations, seen = new Set()) {
  if (!typeNode) return [];

  if (ts.isIntersectionTypeNode(typeNode)) {
    return typeNode.types.flatMap((member) => signaturesOf(member, declarations, seen));
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members.filter(ts.isPropertySignature);
  }

  // A named declaration standing in for the shape, e.g. `type XProps = YProps`.
  const name = ts.isTypeReferenceNode(typeNode)
    ? typeNode.typeName.getText()
    : ts.isExpressionWithTypeArguments(typeNode)
      ? typeNode.expression.getText()
      : null;

  return name ? signaturesOfName(name, declarations, seen) : [];
}

/**
 * Variant-shaped props of a props type: any prop whose type is a union of
 * literals, whether written inline (`size?: 'sm' | 'md'`) or behind an
 * exported alias (`variant?: ButtonVariant`). The alias name is reported when
 * there is one so consumers can import the union type itself.
 */
export function variantsFor(declarations, propsTypeName) {
  const variants = [];

  for (const property of signaturesOfName(propsTypeName, declarations, new Set())) {
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
      const alias = declarations.get(aliasName);
      const values =
        alias && ts.isTypeAliasDeclaration(alias) ? literalUnionValues(alias.type) : null;
      if (values) variants.push({ prop: name, type: aliasName, values });
    }
  }

  return variants;
}

/**
 * The named types a props declaration builds on, which its own prop table does
 * not repeat — `ButtonHTMLAttributes<HTMLButtonElement>` for
 * `type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { … }`.
 *
 * Only members that are a name (with type arguments, possibly) count. An
 * object literal or a discriminated union written inline is the component's own
 * prop surface, already in its prop table, and naming it here would print a
 * type declaration into the middle of a sentence.
 */
export function inheritsOf(declarations, propsTypeName) {
  const declaration = declarations.get(propsTypeName);
  if (!declaration) return null;

  const members = ts.isInterfaceDeclaration(declaration)
    ? heritageTypes(declaration)
    : intersectionMembers(declaration.type);
  const bases = members.filter(
    (node) => ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node),
  );

  return bases.length > 0 ? bases.map(typeText).join(' & ') : null;
}

const HOOK_NAME = /^use[A-Z]/;

/**
 * Everything the manifest reads syntactically out of one file.
 *
 * @param {string} path
 * @returns {{
 *   text: string,
 *   values: string[],
 *   types: string[],
 *   declarations: Map<string, ts.Declaration>,
 *   hooks: { name: string, description: string }[],
 *   relativeImports: string[],
 * }}
 */
export function analyzeSource(path) {
  const text = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const values = [];
  const types = [];
  const hooks = [];
  const relativeImports = [];
  const declarations = new Map();

  const noteValue = (name, node) => {
    values.push(name);
    if (HOOK_NAME.test(name)) hooks.push({ name, description: jsDocDescription(node) });
  };

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.moduleSpecifier.text.startsWith('./')) {
        relativeImports.push(statement.moduleSpecifier.text);
      }
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      declarations.set(statement.name.text, statement);
      if (isExported(statement)) types.push(statement.name.text);
      continue;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement)) {
      noteValue(statement.name.text, statement);
      continue;
    }

    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) noteValue(declaration.name.text, statement);
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

  return { text, values, types, declarations, hooks, relativeImports };
}
