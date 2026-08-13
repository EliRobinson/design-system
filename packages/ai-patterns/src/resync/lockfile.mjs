/* Reads the version a lockfile actually resolved for a dependency.
 *
 * This is the baseline `ds-resync` measures staleness against, and the reason
 * it is the lockfile rather than `node_modules`: the lockfile is what CI and a
 * fresh clone install. A `node_modules` tree that has drifted ahead of the
 * committed manifests is a local accident, not the state of the repo.
 *
 * All three ecosystems are handled, keyed off which lockfile is present, so a
 * consumer on npm or yarn gets the same answer as one on pnpm.
 *
 * Every parser returns the same shape — a flat list of entries — because the
 * only question asked of a lockfile here is "what version is `<name>` at",
 * and a shared shape means the lookup rules (including how to break a tie
 * between two entries for one name) are written once.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
];

const VERSION_ONLY = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

/**
 * A resolved version, or null for anything that is not one. Lockfiles record
 * plenty of non-versions in the same field — `link:../react` for a workspace
 * package, `file:` and git URLs for the rest — and each of those means "this
 * did not come from the registry", which is not something to compare against.
 *
 * pnpm also suffixes a version with the peers it was resolved against
 * (`1.3.0(react@19.2.5)`); that is part of the identity of the install, not of
 * the version, so it is dropped.
 */
function normalizeVersion(value) {
  if (typeof value !== 'string') return null;
  const withoutPeers = value.trim().replace(/\(.*\)$/, '');
  return VERSION_ONLY.test(withoutPeers) ? withoutPeers : null;
}

function unquote(value) {
  const trimmed = value.trim();
  return /^(['"]).*\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
}

/**
 * Enough YAML to read a pnpm lockfile, and deliberately no more: nested maps of
 * plain scalars, two-space indentation, no anchors or multi-line strings.
 * pnpm's output is machine-written and stays inside that subset, and a real
 * YAML parser would be a runtime dependency this package does not otherwise
 * have. Sequence items are skipped — nothing read here lives under one.
 */
function parseYamlMaps(text) {
  const root = {};
  const stack = [{ indent: -1, node: root }];

  for (const raw of text.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('- ')) continue;

    // The key ends at the first `: ` — or at a trailing `:` when the value is a
    // nested block. Values carry colons of their own (`link:packages/react`,
    // a tarball URL), so anything after the first separator is opaque here.
    const separator = trimmed.endsWith(':') ? trimmed.length - 1 : trimmed.indexOf(': ');
    if (separator === -1) continue;

    const indent = raw.length - raw.trimStart().length;
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();

    const parent = stack[stack.length - 1].node;
    const key = unquote(trimmed.slice(0, separator));
    const value = trimmed.slice(separator + 1).trim();

    if (value === '') {
      const node = {};
      parent[key] = node;
      stack.push({ indent, node });
    } else {
      parent[key] = unquote(value);
    }
  }

  return root;
}

const DEPENDENCY_BLOCKS = ['dependencies', 'devDependencies', 'optionalDependencies'];

function collectPnpmBlocks(source, entries) {
  for (const block of DEPENDENCY_BLOCKS) {
    const declared = source?.[block];
    if (!declared || typeof declared !== 'object') continue;

    for (const [name, value] of Object.entries(declared)) {
      // v9 nests `specifier`/`version` under the name; v5 wrote the resolved
      // version as a bare scalar.
      const version = typeof value === 'string' ? value : value?.version;
      entries.push({
        name,
        spec: typeof value === 'string' ? null : (value?.specifier ?? null),
        version: normalizeVersion(version),
      });
    }
  }
}

function parsePnpmLock(text) {
  const document = parseYamlMaps(text);
  const entries = [];

  // The root importer is where a single-package repo's direct dependencies
  // live in v6+. Older lockfiles put them at the top level instead.
  collectPnpmBlocks(document.importers?.['.'] ?? document, entries);

  return entries;
}

function parseNpmLock(text) {
  const document = JSON.parse(text);
  const entries = [];

  for (const [path, record] of Object.entries(document.packages ?? {})) {
    // Only the top-level install: `node_modules/x/node_modules/y` is a nested
    // copy resolved for someone else, and the root importer key is `''`.
    if (!path.startsWith('node_modules/')) continue;
    if (path.indexOf('node_modules/', 1) !== -1) continue;
    // A workspace member is linked, not installed — it has no resolved version.
    if (record?.link) continue;

    entries.push({
      name: path.slice('node_modules/'.length),
      spec: null,
      version: normalizeVersion(record?.version),
    });
  }

  for (const [name, record] of Object.entries(document.dependencies ?? {})) {
    entries.push({ name, spec: null, version: normalizeVersion(record?.version) });
  }

  return entries;
}

/**
 * Splits `@elirobinson/react@npm:^1.3.0` into its name and its range. The last
 * `@` is the separator, since a scoped name starts with one of its own; berry
 * prefixes the range with a protocol, which is not part of what package.json
 * declared.
 */
function splitYarnSpec(spec) {
  const separator = spec.lastIndexOf('@');
  if (separator <= 0) return null;
  return {
    name: spec.slice(0, separator),
    spec: spec.slice(separator + 1).replace(/^npm:/, ''),
  };
}

/**
 * Handles both yarn dialects at once: classic writes `version "1.3.0"`, berry
 * writes `version: 1.3.0`, and the entry header is the same shape in both.
 */
function parseYarnLock(text) {
  const entries = [];
  let pending = [];

  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;

    const isHeader = !/^\s/.test(raw) && raw.trimEnd().endsWith(':');
    if (isHeader) {
      pending = raw
        .trimEnd()
        .slice(0, -1)
        .split(',')
        .map((part) => splitYarnSpec(unquote(part)))
        .filter(Boolean);
      continue;
    }

    const version = /^version:?\s+"?([^"\s]+)"?\s*$/.exec(raw.trim());
    if (!version || pending.length === 0) continue;

    for (const { name, spec } of pending) {
      entries.push({ name, spec, version: normalizeVersion(version[1]) });
    }
    pending = [];
  }

  return entries;
}

const PARSERS = { pnpm: parsePnpmLock, npm: parseNpmLock, yarn: parseYarnLock };

/**
 * @param {string} text lockfile contents
 * @param {'pnpm'|'npm'|'yarn'} kind
 * @returns {{kind: string, entries: Array<{name: string, spec: string|null, version: string|null}>}}
 */
export function parseLockfile(text, kind) {
  return { kind, entries: PARSERS[kind](text) };
}

/** The lockfile in this directory, or null. Order decides which wins when a
 *  repo has more than one, matching how the install command is chosen. */
export function findLockfile(cwd) {
  for (const [filename, kind] of LOCKFILES) {
    const path = join(cwd, filename);
    if (existsSync(path)) return { path, kind };
  }
  return null;
}

/**
 * Reads and parses this directory's lockfile. A lockfile that cannot be read or
 * understood yields null — the same answer as no lockfile at all, which every
 * caller already handles by falling back to the declared range. Failing the
 * whole command over it would be worse than reporting against the range.
 */
export function readLockfile(cwd) {
  const found = findLockfile(cwd);
  if (!found) return null;

  try {
    return parseLockfile(readFileSync(found.path, 'utf-8'), found.kind);
  } catch {
    return null;
  }
}

/**
 * The version this lockfile resolved for `name`, or null when it cannot say.
 *
 * When a name is locked at more than one version — normal in yarn, where each
 * range gets its own entry — the entry whose spec is the range package.json
 * declares is the one that answers for this dependency. With no such match and
 * no single candidate, the answer is null: a wrong baseline here would report a
 * version jump that is not real, which is the bug this module exists to fix.
 */
export function lockedVersionFor(lock, name, declaredRange) {
  const candidates = (lock?.entries ?? []).filter((entry) => entry.name === name);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].version;

  const matched = candidates.filter((entry) => entry.spec === declaredRange);
  if (matched.length === 1) return matched[0].version;

  const versions = new Set(candidates.map((entry) => entry.version));
  return versions.size === 1 ? candidates[0].version : null;
}
