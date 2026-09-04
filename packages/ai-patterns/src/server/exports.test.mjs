// `./server` is a server entry point, and the two ways that goes wrong are both
// silent from inside this repo.
//
// A module added under src/server without an `exports` entry is invisible to
// consumers; the only symptom is an import that fails in their repo. And
// anything browser-only reaching one of these files turns a route handler into
// a build error in whichever bundler the consumer happens to use — or, worse,
// pulls a server module into a client bundle that happened to resolve it.
//
// Both are checked here against what the export map actually resolves to, using
// a self-referencing specifier so the resolution runs through Node's real
// exports handling with no install needed.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const serverDir = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));

/* Which suffixes are internal is package.json's call, not this file's — the
   same derivation testing/playwright.exports.test.mjs makes, and for the same
   reason: a module that does not ship must not be demanded of the export map,
   and a suffix listed here alone would hide a genuinely unexported module. */
const internalSuffixes = manifest.files
  .filter((entry) => entry.startsWith('!'))
  .map((entry) => entry.match(/^!src\/\*\*\/\*(\.[\w.-]+\.mjs)$/))
  .filter((match) => match !== null)
  .map((match) => match[1]);

function modulesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return modulesUnder(path);
    if (!entry.name.endsWith('.mjs')) return [];
    if (internalSuffixes.some((suffix) => entry.name.endsWith(suffix))) return [];
    return [path];
  });
}

const modules = modulesUnder(serverDir);

/* Every `./server…` entry, as { subpath, target absolute path }. */
const entries = Object.entries(manifest.exports)
  .filter(([subpath]) => subpath === './server' || subpath.startsWith('./server/'))
  .map(([subpath, condition]) => ({
    subpath,
    condition,
    target: join(packageDir, condition.import),
    types: join(packageDir, condition.types),
  }));

describe('the server export map', () => {
  it('found the modules and the entries it is comparing', () => {
    expect(modules.length).toBeGreaterThan(0);
    expect(internalSuffixes.length).toBeGreaterThan(0);
    expect(entries.length).toBe(modules.length);
  });

  it('publishes every module under src/server', () => {
    const published = new Set(entries.map((entry) => entry.target));
    const invisible = modules
      .filter((path) => !published.has(path))
      .map((path) => relative(packageDir, path));

    expect(
      invisible,
      `${invisible.join(', ')} ships in the tarball but no export subpath resolves to it — ` +
        'a consumer cannot import it',
    ).toEqual([]);
  });

  /* `ai` is ESM-only, so no `require` condition is offered here: a CommonJS
     require would resolve and then die inside the SDK. Failing at resolution
     names the problem; failing three frames deep does not. */
  it.each(entries)('$subpath declares types and an import condition, and no other', (entry) => {
    expect(Object.keys(entry.condition).sort()).toEqual(['import', 'types']);
    expect(readFileSync(entry.types, 'utf8').length).toBeGreaterThan(0);
  });

  /* Resolved in a real Node process rather than in this one. Vitest runs these
     files through Vite's module runner, whose `import.meta` has no `resolve`
     and whose importer is not Node's — so a subpath resolved here would prove
     nothing about the map a consumer's runtime reads. The child uses a
     self-referencing specifier, which Node answers from this package's own
     `exports` with no install needed. */
  const resolvedByNode = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        'console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(' +
          '(specifier) => [specifier, import.meta.resolve(specifier)]))))',
        JSON.stringify(entries.map(({ subpath }) => `@elirobinson/ai-patterns${subpath.slice(1)}`)),
      ],
      { cwd: packageDir, encoding: 'utf8' },
    ),
  );

  it.each(entries)('$subpath resolves to the file it names', async (entry) => {
    const specifier = `@elirobinson/ai-patterns${entry.subpath.slice(1)}`;

    expect(fileURLToPath(resolvedByNode[specifier])).toBe(entry.target);
    expect(Object.keys(await import(specifier)).length).toBeGreaterThan(0);
  });

  /* The subpath is what a consumer types, so it has to read as a path rather
     than as this repo's directory layout. `./server/surfaces/decision-card`
     mirrors src/server/surfaces/decision-card.mjs, and `./server` is the entry
     the route handler imports. */
  it.each(entries)('$subpath mirrors its file, so neither can be guessed wrong', (entry) => {
    const expected =
      entry.target === join(serverDir, 'stream.mjs')
        ? './server'
        : `./server/${relative(serverDir, entry.target)
            .split(sep)
            .join(posix.sep)
            .replace(/\.mjs$/, '')}`;

    expect(entry.subpath).toBe(expected);
  });
});

/* Comments come out first: this file's own prose mentions browsers, and so does
   the reasoning in the modules it reads. */
function code(path) {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');
}

function specifiers(source) {
  return [...source.matchAll(/\bfrom\s*(['"])([^'"]*)\1/g)].map((match) => match[2]);
}

describe('nothing server-only leaks the other way either', () => {
  const BROWSER_ONLY = [/\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bnavigator\./];

  /* Everything a `files`-published module is allowed to reach: node builtins
     and relative paths need nothing installed, and these two are declared peers
     so a consumer's install resolves them. The dependency boundary suite makes
     the general version of this claim across every package; this one is
     specific enough to name the file that broke it. */
  const ALLOWED = new Set(['ai', 'zod']);

  it.each(modules.map((path) => relative(packageDir, path)))(
    '%s imports nothing a browser bundle would have to resolve',
    (file) => {
      const undeclared = specifiers(code(join(packageDir, file))).filter((specifier) => {
        if (specifier.startsWith('.')) return false;
        if (specifier.startsWith('node:')) return false;
        return !ALLOWED.has(specifier.split('/')[0]);
      });

      expect(
        undeclared,
        `${file} imports ${undeclared.join(', ')} — the server entry may only reach node ` +
          'builtins and the declared peers',
      ).toEqual([]);
    },
  );

  it.each(modules.map((path) => relative(packageDir, path)))(
    '%s touches no browser global',
    (file) => {
      const source = code(join(packageDir, file));
      const found = BROWSER_ONLY.filter((pattern) => pattern.test(source)).map(String);

      expect(found, `${file} reaches for ${found.join(', ')}, which no server has`).toEqual([]);
    },
  );

  it('declares its SDK dependencies as optional peers, never as its own copies', () => {
    for (const name of ['ai', 'zod']) {
      expect(manifest.peerDependencies[name], `${name} is not a peer dependency`).toBeTruthy();
      expect(manifest.peerDependenciesMeta[name].optional).toBe(true);
      expect(manifest.dependencies?.[name]).toBeUndefined();
    }
  });
});
