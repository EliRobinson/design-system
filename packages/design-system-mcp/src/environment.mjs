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

/* An installed @elirobinson/tokens that is too old fails in one of three
 * shapes, none of which names a version: no such subpath in the exports map
 * (`ERR_PACKAGE_PATH_NOT_EXPORTED`, raised as the `cause` of the import's
 * error), the subpath present but a file it reads absent (`ENOENT`), or the
 * module present but missing a function a later release added — which is a
 * plain TypeError with nothing diagnostic in it at all. The first two are
 * recognised here; the third is checked at the call site, where the name of
 * the missing function is known.
 *
 * Anything else is a real failure and goes back untouched: swallowing a
 * genuine bug into "upgrade your tokens" would send a model round a loop that
 * cannot terminate. */
function predatesRelease(error) {
  return error?.code === 'ENOENT' || error?.cause?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED';
}

/**
 * The one shape of "your tokens are too old" message. A model is what reads
 * this, and a model can only act on a message that names the diagnosis, the
 * consequence of carrying on regardless, and the command that fixes it.
 */
function outdatedTokens(diagnosis, consequence, cause) {
  return new Error(
    `The @elirobinson/tokens installed in ${process.cwd()} ${diagnosis}. ${consequence} ` +
      `Upgrade it: pnpm add @elirobinson/tokens (requires the @elirobinson GitHub Packages ` +
      `registry in .npmrc).`,
    { cause },
  );
}

/** The installed tokens package's own `src/`, via its exports map. */
function tokensSrcDir() {
  return dirname(resolveFrom('@elirobinson/tokens/tokens.css', '@elirobinson/tokens'));
}

/** One subpath of the installed tokens package, imported. */
async function importTokens(subpath) {
  return import(
    pathToFileURL(resolveFrom(`@elirobinson/tokens/${subpath}`, '@elirobinson/tokens'))
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
    const srcDir = tokensSrcDir();
    const { parseTokensCss } = await importTokens('parse-tokens-css');
    try {
      const { readTokenStylesheets } = await importTokens('token-stylesheets');
      return parseTokensCss(readTokenStylesheets(srcDir));
    } catch (error) {
      if (!predatesRelease(error)) {
        throw error;
      }
      throw outdatedTokens(
        `predates the palette split (${
          error.code === 'ENOENT' ? `no ${error.path}` : 'no ./token-stylesheets export'
        })`,
        'Its brand lives in src/palettes.css now, and reading tokens.css alone drops every ' +
          'accent, anchor, link and status token without failing.',
        error,
      );
    }
  });
}

/**
 * The three dials of the installed `@elirobinson/tokens`, plus every token's
 * value in every combination.
 *
 * Resolved through the consumer's own exports map, exactly like
 * `designTokens()` above, so what this server reports is what the consumer
 * has installed and not a snapshot of what this repo happened to ship.
 *
 * The roster is never restated here. `PALETTES`, `THEMES`, `PLATFORMS`,
 * `COMBINATIONS` and `DIALS` all arrive from the module, so a third palette
 * added upstream widens this server on a version bump with no edit here —
 * which is the whole reason the dials ship as data rather than as prose.
 *
 * @returns {Promise<{dials: object, entries: object[], ownership: object}>}
 *   `dials` is the whole `@elirobinson/tokens/dials` namespace; `entries` is
 *   `tokenDials()` over the installed stylesheets; `ownership` is
 *   `dialOwnership()` over the same.
 */
export async function designDials() {
  return memo('dials', async () => {
    const srcDir = tokensSrcDir();
    try {
      const dials = await importTokens('dials');
      const stylesheets = await importTokens('token-stylesheets');
      /* The reader for the platform layer arrived a release after the reader
         for the token layer, so a package can export `./token-stylesheets`
         and still not have this function. That miss is a TypeError with no
         code on it, which is why it is caught by name rather than by code. */
      if (typeof stylesheets.readPlatformStylesheets !== 'function') {
        throw outdatedTokens(
          'predates the platform dial (no readPlatformStylesheets in ./token-stylesheets)',
          'Its platform layer is a separate stylesheet, and without the reader every radius ' +
            'and small type step this server reports is the desktop value with nothing saying so.',
        );
      }
      const sources = stylesheets.readTokenStylesheets(srcDir);
      const platformCss = stylesheets.readPlatformStylesheets(srcDir);
      return {
        dials,
        entries: dials.tokenDials(sources, { platformCss }),
        ownership: dials.dialOwnership(sources, platformCss),
      };
    } catch (error) {
      if (!predatesRelease(error)) {
        throw error;
      }
      throw outdatedTokens(
        `predates the three-dial roster (${
          error.code === 'ENOENT' ? `no ${error.path}` : 'no ./dials export'
        })`,
        'Its tokens resolve under three root-element attributes, and without the roster every ' +
          'value this server reports is the default combination alone, unlabelled, with no way ' +
          'for a model to learn the other combinations exist.',
        error,
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
