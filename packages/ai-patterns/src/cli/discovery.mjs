// Reads the *installed* design system out of node_modules at run time, so this
// never goes stale: bumping a package is the only update a consumer needs.
//
// Two properties matter more than anything else here:
//
//   1. Layout-agnostic. Components are discovered by walking the package tree,
//      never by assuming a directory structure. @elirobinson/react went from 24
//      flat components (0.x) to 45 across atoms/molecules/organisms (1.x); the
//      walk survived that without an edit, and it must keep surviving.
//   2. Degrades gracefully. A missing package produces an instruction naming
//      what to install, not a stack trace.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REACT_PKG = '@elirobinson/react';
export const TOKENS_PKG = '@elirobinson/tokens';
export const PATTERNS_PKG = '@elirobinson/ai-patterns';

/**
 * Walk up from each origin looking for node_modules/<name>.
 *
 * cwd comes first: the CLI runs from a consumer's project root, and that is the
 * install the consumer means. The module's own location is the fallback, which
 * is what finds the package under pnpm's nested store layout.
 */
export function findPackageDir(name, origins = defaultOrigins()) {
  const segments = name.split('/');

  for (const origin of origins) {
    let dir = origin;
    for (;;) {
      const candidate = join(dir, 'node_modules', ...segments);
      if (existsSync(join(candidate, 'package.json'))) return candidate;
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  }

  return null;
}

function defaultOrigins() {
  return [process.cwd(), dirname(fileURLToPath(import.meta.url))];
}

/** The directory this CLI ships from, if it really is the ai-patterns package. */
function ownPackageRoot(selfDir) {
  const root = selfDir ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  return readJson(join(root, 'package.json'))?.name === PATTERNS_PKG ? root : null;
}

export function readFile(path) {
  return path && existsSync(path) ? readFileSync(path, 'utf8') : null;
}

export function readJson(path) {
  const raw = readFile(path);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function versionOf(packageDir) {
  return readJson(packageDir && join(packageDir, 'package.json'))?.version ?? null;
}

/** Every file under dir with the given extension, at any depth. */
export function walk(dir, extension) {
  if (!dir || !existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, extension);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

/** Module subpaths under root, e.g. 'Button' or 'atoms/Button'. */
function moduleSubpaths(root, extension) {
  return walk(root, extension)
    .map((path) =>
      relative(root, path)
        .replace(new RegExp(`${extension.replace('.', '\\.')}$`), '')
        .split(sep)
        .join('/'),
    )
    .sort();
}

// --- .d.ts fallback -------------------------------------------------------
// Only used when the installed @elirobinson/react predates dist/manifest.json.
// These regexes are exactly the reason the manifest exists; they are kept
// because an older install is still worth describing.

function declaredValues(declaration) {
  return [...declaration.matchAll(/export declare (?:const|function) (\w+)/g)].map(
    (match) => match[1],
  );
}

function declaredUnions(declaration) {
  return [...declaration.matchAll(/export (?:type|declare type) (\w+) = ((?:'[^']*'\s*\|?\s*)+);/g)]
    .map(([, name, body]) => ({
      name,
      values: [...body.matchAll(/'([^']*)'/g)].map((match) => match[1]),
    }))
    .filter(({ values }) => values.length > 1);
}

/**
 * Derive a manifest-shaped inventory from emitted declarations. Variant props
 * cannot be recovered reliably this way, so each union is reported under the
 * lower-cased remainder of its type name (ButtonVariant -> variant), which is
 * the convention every component in the package follows.
 */
function inventoryFromDeclarations(packageDir, packageName) {
  const componentsDir = join(packageDir, 'dist', 'components');
  const hooksDir = join(packageDir, 'dist', 'hooks');

  const components = moduleSubpaths(componentsDir, '.d.ts').map((subpath) => {
    const declaration = readFile(join(componentsDir, `${subpath}.d.ts`)) ?? '';
    const segments = subpath.split('/');
    const name = segments.at(-1);

    return {
      name,
      tier: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
      subpath,
      importSpecifier: `${packageName}/components/${subpath}`,
      exports: declaredValues(declaration),
      types: [],
      propsType: declaration.includes(`${name}Props`) ? `${name}Props` : null,
      variants: declaredUnions(declaration).map(({ name: type, values }) => ({
        prop: type.replace(name, '').toLowerCase() || type.toLowerCase(),
        type,
        values,
      })),
    };
  });

  const hooks = moduleSubpaths(hooksDir, '.d.ts').map((subpath) => ({
    name: subpath.split('/').at(-1),
    subpath,
    importSpecifier: `${packageName}/hooks/${subpath}`,
    exports: declaredValues(readFile(join(hooksDir, `${subpath}.d.ts`)) ?? ''),
    types: [],
  }));

  return {
    manifestVersion: 0,
    package: packageName,
    version: versionOf(packageDir),
    tiers: [...new Set(components.map((entry) => entry.tier).filter(Boolean))].sort(),
    components: components.filter((entry) => entry.exports.length > 0),
    hooks: hooks.filter((entry) => entry.exports.length > 0),
  };
}

/**
 * The component inventory, preferring the manifest the package now ships.
 * `source` says which path was taken so `ds` can tell the user.
 */
export function loadInventory(packageDir) {
  if (!packageDir) return null;

  const packageName = readJson(join(packageDir, 'package.json'))?.name ?? REACT_PKG;
  const manifest = readJson(join(packageDir, 'dist', 'manifest.json'));

  if (manifest?.components) return { ...manifest, source: 'manifest' };

  return { ...inventoryFromDeclarations(packageDir, packageName), source: 'declarations' };
}

// --- CSS ------------------------------------------------------------------

export function cssClasses(css) {
  if (!css) return [];
  return [...new Set([...css.matchAll(/^\.([\w-]+)/gm)].map((match) => match[1]))].sort();
}

/**
 * Custom properties declared on `:root`, with CSS's last-declaration-wins
 * applied — `--status-success` is declared in the base scale and then
 * re-pointed at a brand color, and `ds tokens` must print the one that wins.
 *
 * This deliberately does NOT import `parseTokensCss` from @elirobinson/tokens,
 * which owns that parser everywhere else in the monorepo. Importing it would
 * make @elirobinson/tokens a *runtime* dependency of this package, and
 * `findPackageDir` walks up from this module's own location as well as the
 * consumer's cwd — so the package manager's private copy would be found and
 * `ds` would report tokens as installed, at ai-patterns' pinned version, in a
 * project that has not installed it. That would break the graceful degradation
 * this file's header calls load-bearing. `discovery.test.mjs` asserts this
 * function agrees with the shared parser on the real tokens.css instead.
 */
export function cssVariables(css) {
  if (!css) return [];

  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const seen = new Map();
  for (const [, name, value] of root.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    seen.set(name, value.trim());
  }
  return [...seen.entries()].map(([name, value]) => ({ name, value }));
}

/**
 * Resolve every package the CLI can describe. Missing ones are null; each
 * command decides for itself whether it can still do its job.
 */
export function loadEnvironment(origins, selfDir) {
  const react = findPackageDir(REACT_PKG, origins);
  const tokens = findPackageDir(TOKENS_PKG, origins);

  // This CLI *is* @elirobinson/ai-patterns, so its own package root is always a
  // valid source for patterns, contracts and prompts. That matters when the
  // binary is not installed in the project it is describing — `pnpm dlx
  // @elirobinson/ai-patterns elirobinson-ds` runs from a throwaway store, and
  // without this fallback every command backed by this package's own data would
  // report itself as not installed.
  const patterns = findPackageDir(PATTERNS_PKG, origins) ?? ownPackageRoot(selfDir);

  return {
    react,
    tokens,
    patterns,
    versions: {
      [REACT_PKG]: versionOf(react),
      [TOKENS_PKG]: versionOf(tokens),
      [PATTERNS_PKG]: versionOf(patterns),
    },
    inventory: loadInventory(react),
    tokensCss: readFile(tokens && join(tokens, 'src', 'tokens.css')),
    componentCss: walk(react && join(react, 'src'), '.css')
      .map((path) => readFile(path))
      .join('\n'),
  };
}
