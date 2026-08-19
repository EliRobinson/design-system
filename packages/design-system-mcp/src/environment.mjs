/* Reads the *installed* design system out of the consuming project's
 * node_modules — the same property the `elirobinson-ds` CLI has: nothing this
 * server reports can go stale, because it never reads a snapshot and never
 * the network. The consumer bumps a version and every prop table, token, and
 * constraint an agent sees is current.
 *
 * Resolution is rooted at process.cwd(): `.mcp.json` launches the server at
 * the project root, and that project's install is the one the consumer
 * means. Every miss degrades to an instruction naming what to install, not a
 * stack trace — the message is read by a model, which can only act on a
 * message that says what to do.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRequire = createRequire(join(process.cwd(), 'package.json'));

function resolveFrom(specifier, installName) {
  try {
    return projectRequire.resolve(specifier);
  } catch (error) {
    throw new Error(
      `Cannot resolve ${specifier} from ${process.cwd()}. ` +
        `Install the package this server reads: pnpm add ${installName} ` +
        `(requires the @elirobinson GitHub Packages registry in .npmrc).`,
      { cause: error },
    );
  }
}

const cache = new Map();

function memo(key, load) {
  if (!cache.has(key)) {
    cache.set(key, load());
  }
  return cache.get(key);
}

/** `@elirobinson/react/manifest` — the one component inventory. */
export function componentManifest() {
  return memo('manifest', () =>
    JSON.parse(
      readFileSync(resolveFrom('@elirobinson/react/manifest', '@elirobinson/react'), 'utf8'),
    ),
  );
}

/** Every token stylesheet from the installed `@elirobinson/tokens`, parsed.
 *
 * tokens.css alone is not the vocabulary any more and does not say so: it
 * parses, it returns a couple of hundred declarations, and the entire brand is
 * absent — `search_tokens` would answer "no token matches --accent" and
 * `buildAdherenceConfig` would call every accent token in a consumer's code an
 * invented value. So the file is resolved through the consumer's own exports
 * map as before, and its directory is handed to the package's own reader,
 * which knows the roster. */
export async function designTokens() {
  return memo('tokens', async () => {
    const cssPath = resolveFrom('@elirobinson/tokens/tokens.css', '@elirobinson/tokens');
    const { parseTokensCss } = await import(
      pathToFileURL(resolveFrom('@elirobinson/tokens/parse-tokens-css', '@elirobinson/tokens'))
    );
    try {
      const { readTokenStylesheets } = await import(
        pathToFileURL(resolveFrom('@elirobinson/tokens/token-stylesheets', '@elirobinson/tokens'))
      );
      return parseTokensCss(readTokenStylesheets(dirname(cssPath)));
    } catch (error) {
      /* Two shapes of one fact: the installed tokens package predates the
         palette split. Old enough and it has no ./token-stylesheets export to
         resolve; one release later it has the reader but not every file the
         reader asks for. Neither `ERR_PACKAGE_PATH_NOT_EXPORTED` nor a bare
         ENOENT says which version to install, and a model is what reads this.
         Anything else is a real failure and goes back untouched. */
      const missingExport = error?.cause?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED';
      if (error?.code !== 'ENOENT' && !missingExport) {
        throw error;
      }
      throw new Error(
        `The @elirobinson/tokens installed in ${process.cwd()} predates the palette split ` +
          `(${missingExport ? 'no ./token-stylesheets export' : `no ${error.path}`}). Its brand ` +
          `lives in src/palettes.css now, and reading tokens.css alone drops every accent, ` +
          `anchor, link and status token without failing. Upgrade it: ` +
          `pnpm add @elirobinson/tokens (requires the @elirobinson GitHub Packages registry ` +
          `in .npmrc).`,
        { cause: error },
      );
    }
  });
}

/** `@elirobinson/ai-patterns/contracts` — the machine-checkable UX contracts. */
export function contracts() {
  return memo('contracts', () =>
    JSON.parse(
      readFileSync(
        resolveFrom('@elirobinson/ai-patterns/contracts', '@elirobinson/ai-patterns'),
        'utf8',
      ),
    ),
  );
}

/** `@elirobinson/ai-patterns/brand-manifest` — one record per brand artifact. */
export function brandManifest() {
  return memo('brand-manifest', () =>
    JSON.parse(
      readFileSync(
        resolveFrom('@elirobinson/ai-patterns/brand-manifest', '@elirobinson/ai-patterns'),
        'utf8',
      ),
    ),
  );
}

/** The brand voice rules, extracted by the corpus generator's own extractor. */
export async function brandVoiceRules() {
  return memo('brand-voice', async () => {
    const readme = readFileSync(
      resolveFrom('@elirobinson/ai-patterns/brand-readme', '@elirobinson/ai-patterns'),
      'utf8',
    );
    const { brandVoice } = await import(
      pathToFileURL(resolveFrom('@elirobinson/ai-patterns/corpus', '@elirobinson/ai-patterns'))
    );
    return brandVoice(readme);
  });
}

/** The adherence config builder from the installed ai-patterns. */
export async function adherenceConfig() {
  return memo('adherence', async () => {
    const { buildAdherenceConfig } = await import(
      pathToFileURL(resolveFrom('@elirobinson/ai-patterns/adherence', '@elirobinson/ai-patterns'))
    );
    return buildAdherenceConfig({
      manifest: componentManifest(),
      tokens: await designTokens(),
    });
  });
}
