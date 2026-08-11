// The half of the manifest that needs a resolved TypeScript program:
// per-prop types, defaults, and JSDoc, including everything a component
// inherits from React's DOM attribute types. react-docgen-typescript does the
// work; this module owns the two things that are easy to get wrong around it.
//
// 1. One program for the whole package. react-docgen-typescript's `parse()`
//    builds a fresh ts.Program per call, which for 45 components meant
//    re-reading lib.d.ts and every @types package 45 times. Building the
//    program once and handing it back through `parseWithProgramProvider` is
//    the same output an order of magnitude faster.
// 2. No tsconfig is not an error. A package with no tsconfig — a fixture
//    directory, say — falls back to react-docgen-typescript's own defaults so
//    the rest of the manifest still gets built.

import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { withCompilerOptions } from 'react-docgen-typescript';
import ts from 'typescript';

/** react-docgen-typescript's own defaults, used when there is no tsconfig. */
const FALLBACK_OPTIONS = {
  jsx: ts.JsxEmit.React,
  // CommonJS, so moduleResolution defaults to Node and bare imports resolve.
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.Latest,
  esModuleInterop: true,
};

const PARSER_OPTIONS = {
  shouldExtractLiteralValuesFromEnum: true,
  shouldRemoveUndefinedFromOptional: true,
  savePropValueAsString: true,
  /* Props declared only inside node_modules are inherited DOM/library
     attributes; `inherits` names the base instead of listing them all. */
  propFilter: (prop) =>
    prop.declarations && prop.declarations.length > 0
      ? prop.declarations.some((declaration) => !declaration.fileName.includes('node_modules'))
      : true,
};

/**
 * A package with no tsconfig falls back to defaults; a package whose tsconfig
 * is broken does not. Quietly degrading there would publish prop tables missing
 * whatever the real options resolve, with nothing to say why.
 */
function compilerOptions(tsconfigPath) {
  if (!tsconfigPath || !existsSync(tsconfigPath)) return FALLBACK_OPTIONS;

  const { config, error } = ts.readConfigFile(tsconfigPath, (name) => readFileSync(name, 'utf8'));
  if (error) {
    throw new Error(
      `Cannot read ${tsconfigPath}: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`,
    );
  }

  return ts.parseJsonConfigFileContent(config, ts.sys, dirname(tsconfigPath), {}, tsconfigPath)
    .options;
}

/**
 * Parse every file once against a shared program.
 *
 * @param {string[]} files absolute paths
 * @param {string | null} tsconfigPath the package's tsconfig, if it has one
 * @returns {Map<string, import('react-docgen-typescript').ComponentDoc[]>}
 */
export function parseComponentDocs(files, tsconfigPath) {
  if (files.length === 0) return new Map();

  const options = compilerOptions(tsconfigPath);
  const parser = withCompilerOptions(options, PARSER_OPTIONS);
  const program = ts.createProgram(files, options);

  return new Map(
    files.map((file) => [file, parser.parseWithProgramProvider([file], () => program)]),
  );
}

/* docgen reports literal unions as the type name "enum" with the members in
   type.value — render the union itself, which is what a reader needs. */
function displayType(type) {
  if (type.name === 'enum' && Array.isArray(type.value)) {
    return type.value.map((member) => member.value).join(' | ');
  }
  return type.name;
}

/** One component's props, required first then alphabetical. */
export function toPropRecords(doc) {
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
