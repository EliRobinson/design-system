/* Reads the consuming repo's installed @elirobinson/react and @elirobinson/tokens,
 * so `ds-resync artifacts` can generate from them rather than from the snapshot
 * staged when ai-patterns was packed (#257).
 *
 * Packages are found by `findPackageDir`, which walks the `node_modules`
 * directories from `cwd` up to the root: where an import in that repo looks. A
 * workspace member with no `node_modules` of its own therefore finds the
 * hoisted copy, exactly as its code does. `require.resolve.paths` is
 * deliberately not used: it appends NODE_PATH and the global folders, and
 * `pnpm exec` / `pnpm dlx` set NODE_PATH to pnpm's own store, which would find a
 * copy the repo does not have.
 *
 * The token parser is the INSTALLED tokens package's own, imported from it.
 * ai-patterns only devDepends on tokens, so a consumer has no other copy, and
 * the parser that ships with a stylesheet is the one that understands it. That
 * runs the consumer's installed package code: the same trust as their own build.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { REACT_PKG, readInstalled, TOKENS_PKG } from '../package-lookup.mjs';

/** Resolves an exported subpath of an installed package through its own
 *  exports map, the way an import in the consuming repo would. */
export function resolveIn(root, specifier) {
  return createRequire(join(root, 'package.json')).resolve(specifier);
}

async function importIn(root, specifier) {
  return import(pathToFileURL(resolveIn(root, specifier)).href);
}

/**
 * Everything the generated artifacts need from the two installed packages, or
 * the reason they cannot be read. Never throws: any failure is a reason, and
 * the caller falls back to the bundled snapshot.
 *
 * `reactVersion` is set whenever react was found, so a fallback can still say
 * whether the snapshot describes the react that is installed.
 *
 * @returns {Promise<
 *   | { ok: true, reactVersion: string, tokensVersion: string, manifest: object,
 *       tokens: object[], roots: Record<string, string> }
 *   | { ok: false, reason: string, reactVersion: string | null }
 * >}
 */
export async function readInstalledSources(cwd) {
  let react = null;
  try {
    react = readInstalled(cwd, REACT_PKG);
    const tokens = readInstalled(cwd, TOKENS_PKG);
    const missing = [
      !react && `${REACT_PKG} is not installed`,
      !tokens && `${TOKENS_PKG} is not installed`,
    ].filter(Boolean);
    if (missing.length) {
      return { ok: false, reason: missing.join(' and '), reactVersion: react?.version ?? null };
    }

    const manifest = JSON.parse(
      readFileSync(resolveIn(react.root, `${REACT_PKG}/manifest`), 'utf8'),
    );
    const { parseTokensCss } = await importIn(tokens.root, `${TOKENS_PKG}/parse-tokens-css`);
    const { readTokenStylesheets } = await importIn(tokens.root, `${TOKENS_PKG}/token-stylesheets`);

    return {
      ok: true,
      reactVersion: react.version,
      tokensVersion: tokens.version,
      manifest,
      tokens: parseTokensCss(readTokenStylesheets()),
      roots: { [REACT_PKG]: react.root, [TOKENS_PKG]: tokens.root },
    };
  } catch (error) {
    return {
      ok: false,
      reason: `the installed packages could not be read (${error.message})`,
      reactVersion: react?.version ?? null,
    };
  }
}
