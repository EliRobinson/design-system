/* Reads a package.json `exports` map the way Node does, and turns it into the
 * list of concrete subpaths a consumer can write.
 *
 * The list comes from the packed package.json, never from a hand-kept table,
 * so a new subpath is covered the day it ships. Pattern keys (`./components/*`)
 * are expanded against the files that are actually in the tarball, which is
 * the only honest answer to "what can a consumer import": a pattern whose
 * target matches nothing exports nothing.
 */

/** The `exports` field as `[key, target]` pairs, with the sugar forms unfolded. */
export function exportKeys(exportsField) {
  if (exportsField == null) return [];
  if (typeof exportsField === 'string' || Array.isArray(exportsField)) {
    return [['.', exportsField]];
  }
  const keys = Object.keys(exportsField);
  // `{ "import": "./x.js" }` at the top level is conditions for ".".
  if (keys.length > 0 && !keys[0].startsWith('.')) return [['.', exportsField]];
  return keys.map((key) => [key, exportsField[key]]);
}

/**
 * Every leaf of a target, as `{ conditions, file }`. `conditions` is the path of
 * condition names that leads to it, outermost first. A `null` leaf blocks the
 * subpath and yields nothing; an array is a fallback list, and only its first
 * usable string is what Node would pick.
 */
export function targetLeaves(target, conditions = []) {
  if (target == null) return [];
  if (typeof target === 'string') return [{ conditions, file: target }];
  if (Array.isArray(target)) {
    for (const entry of target) {
      const leaves = targetLeaves(entry, conditions);
      if (leaves.length > 0) return leaves;
    }
    return [];
  }
  return Object.entries(target).flatMap(([condition, inner]) =>
    targetLeaves(inner, [...conditions, condition]),
  );
}

/** `./dist/*.js` against `./dist/a/b.js` → `a/b`, or null when it does not match. */
export function matchPattern(pattern, file) {
  const star = pattern.indexOf('*');
  if (star === -1) return pattern === file ? '' : null;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (file.length < prefix.length + suffix.length) return null;
  if (!file.startsWith(prefix) || !file.endsWith(suffix)) return null;
  return file.slice(prefix.length, file.length - suffix.length);
}

/* The conditions a runtime load goes through. `types` is only ever read by a
   type checker, so a subpath is expanded from the files its runtime target
   matches, not from its declarations. */
const RUNTIME = new Set(['import', 'require', 'default', 'node']);

function runtimeLeaf(leaves) {
  return leaves.find((leaf) => leaf.conditions.every((c) => RUNTIME.has(c))) ?? leaves[0];
}

/* How a consumer reaches a subpath at run time: `import` when some leaf sits
   only under conditions an ESM import matches, `require` when some leaf sits
   under `require`. A subpath reachable by neither (types only, or behind a
   `style` or `browser` condition) is one no Node consumer can load. */
const IMPORT_CONDITIONS = new Set([...RUNTIME].filter((condition) => condition !== 'require'));

function reach(leaves) {
  return {
    viaImport: leaves.some((leaf) => leaf.conditions.every((c) => IMPORT_CONDITIONS.has(c))),
    viaRequire: leaves.some((leaf) => leaf.conditions.includes('require')),
  };
}

/**
 * The concrete subpaths a package exports.
 *
 * @param {unknown} exportsField the `exports` field of the packed package.json
 * @param {string[]} files every file in the package, as `./`-prefixed paths
 * @returns {{ key: string, subpath: string, passthrough: boolean, viaImport: boolean, viaRequire: boolean, leaves: { conditions: string[], file: string }[] }[]}
 *   `key` is the map key it came from (a pattern for an expanded one), and each
 *   leaf's `file` has the pattern substituted. `passthrough` marks a pattern
 *   whose target ends in the star (`./artifacts/*` → `./dist/artifacts/*`): it
 *   hands out whatever file is there, for reading or copying, not modules.
 *   `viaImport` and `viaRequire` say which loaders reach it.
 */
export function expandExports(exportsField, files) {
  const expanded = [];
  for (const [key, target] of exportKeys(exportsField)) {
    const leaves = targetLeaves(target);
    if (leaves.length === 0) continue;

    if (!key.includes('*')) {
      expanded.push({ key, subpath: key, passthrough: false, ...reach(leaves), leaves });
      continue;
    }

    const pattern = runtimeLeaf(leaves).file;
    const passthrough = pattern.endsWith('*');
    const stars = files
      .map((file) => matchPattern(pattern, file))
      .filter((star) => star !== null && star !== '')
      .sort();
    for (const star of stars) {
      expanded.push({
        key,
        subpath: key.replace('*', star),
        passthrough,
        ...reach(leaves),
        leaves: leaves.map((leaf) => ({ ...leaf, file: leaf.file.replaceAll('*', star) })),
      });
    }
  }
  return expanded;
}

/** The specifier a consumer writes for a subpath. */
export function specifierFor(name, subpath) {
  return subpath === '.' ? name : `${name}/${subpath.slice(2)}`;
}

/**
 * Resolves `subpath` through an `exports` map under a given condition set, the
 * way a CSS bundler does for `@import '<pkg>/<subpath>'` — Node's own resolver
 * cannot be used for this, because it does not know the `style` condition and
 * would hand back tailwindcss's JavaScript entry for `@import 'tailwindcss'`.
 *
 * @returns {string | null} the `./`-relative file, or null when not exported
 */
export function resolveExport(exportsField, subpath, conditions) {
  const pick = (target, star) => {
    if (target == null) return null;
    if (typeof target === 'string') return star == null ? target : target.replaceAll('*', star);
    if (Array.isArray(target)) {
      for (const entry of target) {
        const found = pick(entry, star);
        if (found) return found;
      }
      return null;
    }
    for (const [condition, inner] of Object.entries(target)) {
      if (condition === 'default' || conditions.includes(condition)) {
        const found = pick(inner, star);
        if (found) return found;
      }
    }
    return null;
  };

  const keys = exportKeys(exportsField);
  const exact = keys.find(([key]) => key === subpath);
  if (exact) return pick(exact[1], null);

  /* Node picks the pattern with the longest prefix before the star. */
  let best = null;
  for (const [key, target] of keys) {
    const star = matchPattern(key, subpath);
    if (star === null || !key.includes('*')) continue;
    if (!best || key.indexOf('*') > best.key.indexOf('*')) best = { key, target, star };
  }
  return best ? pick(best.target, best.star) : null;
}
