/* Reads the consuming repo's installed @elirobinson/react and @elirobinson/tokens,
 * so `ds-resync artifacts` can generate from them rather than from the snapshot
 * staged when ai-patterns was packed (#257).
 *
 * Resolution walks the `node_modules` directories from `cwd` up to the root,
 * which is where an import in that repo looks. A workspace member with no
 * `node_modules` of its own therefore finds the hoisted copy, exactly as its
 * code does. `require.resolve.paths` is deliberately not used: it appends
 * NODE_PATH and the global folders, and `pnpm exec` / `pnpm dlx` set NODE_PATH
 * to pnpm's own store, which would find a copy the repo does not have.
 *
 * The token parser is the INSTALLED tokens package's own, imported from it.
 * ai-patterns only devDepends on tokens, so a consumer has no other copy, and
 * the parser that ships with a stylesheet is the one that understands it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REACT_PACKAGE = '@elirobinson/react';
export const TOKENS_PACKAGE = '@elirobinson/tokens';

/**
 * The installed copy of `name` as Node would find it from `cwd`.
 *
 * @returns {{ root: string, version: string } | null} null when not installed
 */
export function findInstalledPackage(cwd, name) {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const root = join(dir, 'node_modules', ...name.split('/'));
    const manifestPath = join(root, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      return { root, version: manifest.version ?? null };
    }
    if (dirname(dir) === dir) return null;
  }
}

/** Resolves an exported subpath of a package found by `findInstalledPackage`,
 *  through that package's own exports map. */
function resolveIn(root, specifier) {
  return createRequire(join(root, 'package.json')).resolve(specifier);
}

async function importIn(root, specifier) {
  return import(pathToFileURL(resolveIn(root, specifier)).href);
}

/**
 * Everything the generated artifacts need from the two installed packages, or
 * the reason they cannot be read.
 *
 * @returns {Promise<
 *   | { ok: true, react: { version: string, manifest: object },
 *       tokens: { version: string, root: string, tokens: object[] },
 *       roots: Record<string, string> }
 *   | { ok: false, reason: string }
 * >}
 */
export async function readInstalledSources(cwd) {
  const react = findInstalledPackage(cwd, REACT_PACKAGE);
  const tokens = findInstalledPackage(cwd, TOKENS_PACKAGE);
  const missing = [
    !react && `${REACT_PACKAGE} is not installed`,
    !tokens && `${TOKENS_PACKAGE} is not installed`,
  ].filter(Boolean);
  if (missing.length) return { ok: false, reason: missing.join('; ') };

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolveIn(react.root, `${REACT_PACKAGE}/manifest`), 'utf8'));
  } catch (error) {
    return {
      ok: false,
      reason: `${REACT_PACKAGE}@${react.version} has no readable ./manifest (${error.message})`,
    };
  }

  let parsed;
  try {
    const { parseTokensCss } = await importIn(tokens.root, `${TOKENS_PACKAGE}/parse-tokens-css`);
    const { readTokenStylesheets } = await importIn(
      tokens.root,
      `${TOKENS_PACKAGE}/token-stylesheets`,
    );
    parsed = parseTokensCss(readTokenStylesheets());
  } catch (error) {
    return {
      ok: false,
      reason:
        `${TOKENS_PACKAGE}@${tokens.version} cannot be parsed for tokens ` +
        `(${error.message}). Upgrade it to a version that exports ./parse-tokens-css ` +
        'and ./token-stylesheets',
    };
  }

  return {
    ok: true,
    react: { version: react.version, manifest },
    tokens: { version: tokens.version, root: tokens.root, tokens: parsed },
    roots: { [REACT_PACKAGE]: react.root, [TOKENS_PACKAGE]: tokens.root },
  };
}
