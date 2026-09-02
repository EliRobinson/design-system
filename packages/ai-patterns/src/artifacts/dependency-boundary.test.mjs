/* The dependency boundary, enforced.
 *
 * One rule, mechanical: no published file may import a package the publishing manifest
 * does not declare as a `dependency`, a `peerDependency` or an `optionalDependency`.
 * Node builtins, relative paths and the package's own name are the only other things a
 * consumer is guaranteed to be able to resolve.
 *
 * It exists because @elirobinson/react shipped its own 37-file test suite and its four-file
 * test harness for the whole of its published life (#220). `files` was
 * `["dist","src","CHANGELOG.md"]` — the one manifest in the repo with no negations — so
 * every `*.test.tsx` reached the registry, each one importing `vitest`,
 * `@testing-library/react` and `@testing-library/user-event`, none of which is a runtime
 * dependency of the package. That is inert for a bundler resolving an explicit subpath and
 * live for anything that walks `src/`: a `tsc` with `skipLibCheck: false`, a
 * typescript-eslint project service, an IDE indexing `node_modules`, or a consumer
 * following this repo's own no-barrel-files convention into a source subpath.
 *
 * Review had four chances to catch it — the four other manifests all carry the negation —
 * and did not, because the missing line is invisible by construction: you have to notice
 * an absence, in a file nobody diffs. Worse, the obvious copy-paste fix would not have
 * worked. Every other package's negation excludes `.test.mjs` files, and react's tests are
 * `.test.tsx`, so the pattern carried across would have matched nothing and passed review
 * looking exactly like a fix. This file is the version of that review that cannot be
 * skipped: it reads what `files` actually resolves to, not what it appears to say.
 * (No glob in a block comment here may end in a star followed by a slash — that closes the
 * comment. nx.json carries the same warning for the same reason.)
 *
 * "Published" comes from published-files.test-helper.mjs — the same reader
 * brand-boundary.test.mjs uses, deliberately shared rather than reimplemented. Both suites
 * assert "no PUBLISHED file may X", and a second implementation of npm's `files`
 * negation semantics would be a second chance to get them wrong in the direction that
 * fails by passing. #214 is the record of that drift happening once already.
 *
 * Type-only imports count. `import type { X } from 'vitest'` is erased by the bundler and
 * is still a hard error for the consumer's `tsc`, which is one of the four readers above
 * and the one most likely to be pointed at `node_modules` sources.
 *
 * Stylesheets count too. A published `@import '@elirobinson/tokens/tokens.css'` needs that
 * package on disk exactly as an ESM import does, and react's styles.css is a real instance
 * of the dependency being genuinely required.
 */

import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';

import { describe, expect, it } from 'vitest';

import { publishedPackages } from './published-files.test-helper.mjs';

const BUILTINS = new Set(builtinModules);

/* .js .cjs .mjs .jsx .ts .cts .mts .tsx, and so every .d.ts and .d.mts as well. */
const SCRIPT = /\.(?:c|m)?[jt]sx?$/;
const STYLESHEET = /\.css$/;

/* The delimiter a masked string literal is wrapped in. NUL because no module specifier
   can contain one, so a placeholder can never be confused with a real import. Written as
   an escape and compared with string methods rather than matched with a regex: a raw
   control character in a source file makes `grep` call it binary, and the regex form is
   what `no-control-regex` exists to reject. */
const MARK = '\u0000';

/* Imports this suite permits, per file AND per specifier.
 *
 * Per specifier rather than per file on purpose, copying the shape brand-boundary.test.mjs
 * uses for its brand manifest: a permission is granted to the one import that was reasoned
 * about, so the same file importing something else undeclared tomorrow is still red. A
 * file-level permission would be a hole the width of the file.
 *
 * A permitted entry has to stay true — "every permission is still needed" below deletes
 * this table's ability to rot by failing when the import it names is gone. */
const PERMITTED = [
  {
    file: 'packages/ai-patterns/src/artifacts/guideline-cards.mjs',
    specifier: '@elirobinson/tokens/dials',
    /* Build-time only, and the file's own docblock says so at length: nothing in
       @elirobinson/ai-patterns' exports map reaches it, its callers being
       scripts/build-design-project.mjs, brand-manifest.mjs and the tests — none of which
       a consumer can enter. @elirobinson/tokens is deliberately a devDependency here,
       because ai-patterns generating cards from the token scale must not make every
       consumer of the CLI install the token package.
       Kept as a permission rather than fixed, because the two fixes are both worse:
       promoting tokens to a dependency imposes it on consumers who never build cards, and
       excluding the file from `files` would silently break the day something published
       does reach it. The invariant that makes this safe is written in guideline-cards.mjs
       itself — if that file ever becomes reachable from a published entry point the roster
       has to be passed in from the build script instead of imported, and this row deleted. */
    reason: 'build-time only; unreachable from the exports map (see its docblock)',
  },
];

/**
 * Blank out everything in a source file that is not code, keeping module specifiers.
 *
 * Necessary rather than fastidious. Both false-positive shapes are real files in this
 * repo, and a guard that has to be suppressed on them is a guard nobody keeps:
 *
 *   - llms.mjs holds the corpus's worked examples as ordinary quoted strings —
 *     `"  import '@elirobinson/react/styles.css';"` and four more. Read naively they are
 *     five undeclared imports in a file that imports nothing.
 *   - tailwind.css opens with a usage block showing `@import 'tailwindcss';` inside a
 *     comment. Read naively, tokens depends on Tailwind, which is the whole point of that
 *     file being a bridge rather than a dependency.
 *
 * So: comments and template-literal bodies become spaces, and each quoted string is
 * replaced by a NUL-delimited index into `literals`. Nesting a string inside a string is
 * then impossible by construction — the outer one is consumed whole — while a genuine
 * specifier is still recoverable from the index.
 *
 * Regex literals are skipped rather than ignored, and that is not decoration.
 * brand-manifest.mjs contains `/(?:url\(\s*['"]?|@import\s+['"])(https?:...)/g` and
 * lockfile.mjs `/^version:?\s+"?([^"\s]+)"?\s*$/`. Treating those quote characters as
 * string delimiters pairs them with the next real quote in the file and swallows whatever
 * lies between — including, potentially, an import statement. That is a false NEGATIVE,
 * the one failure mode a guard cannot afford. Telling a regex from a division uses the
 * usual preceding-token rule.
 */
function maskLiterals(source) {
  const literals = [];
  const blank = (text) => text.replace(/[^\n]/g, ' ');

  let out = '';
  let tail = '';
  let index = 0;
  /* One frame per template literal we are inside. `braces` is 0 in the literal's text and
     counts up through `${ ... }`, so the code in a substitution is read as code and a
     template nested inside one closes its own frame rather than its parent's. */
  const frames = [];

  const emit = (text, isCode) => {
    out += text;
    if (isCode) tail = (tail + text).slice(-32);
  };

  while (index < source.length) {
    const frame = frames.at(-1);
    const char = source[index];

    if (frame && frame.braces === 0) {
      if (char === '\\') {
        emit(blank(source.slice(index, index + 2)), false);
        index += 2;
        continue;
      }
      if (char === '`') {
        frames.pop();
        emit(' ', false);
        index += 1;
        continue;
      }
      if (char === '$' && source[index + 1] === '{') {
        frame.braces = 1;
        emit('  ', false);
        index += 2;
        continue;
      }
      emit(blank(char), false);
      index += 1;
      continue;
    }

    if (char === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? source.length : end;
      emit(blank(source.slice(index, stop)), false);
      index = stop;
      continue;
    }

    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      emit(blank(source.slice(index, stop)), false);
      index = stop;
      continue;
    }

    if (char === '/' && startsRegex(tail)) {
      index = emitRegex(source, index, emit, blank);
      continue;
    }

    if (char === '`') {
      frames.push({ braces: 0 });
      emit(' ', false);
      index += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      const close = closingQuote(source, index);
      /* Unterminated before the line ends: not a string at all, so the quote goes through
         as an ordinary character rather than being allowed to pair with a later one. */
      if (close === -1) {
        emit(char, true);
        index += 1;
        continue;
      }
      literals.push(source.slice(index + 1, close));
      emit(`${char}${MARK}${literals.length - 1}${MARK}${char}`, true);
      index = close + 1;
      continue;
    }

    if (frame && char === '{') frame.braces += 1;
    if (frame && char === '}') {
      frame.braces -= 1;
      if (frame.braces === 0) {
        emit(' ', false);
        index += 1;
        continue;
      }
    }

    emit(char, true);
    index += 1;
  }

  return { masked: out, literals };
}

/* A `/` opens a regex unless what precedes it could end an expression. `)` and `]` and an
   identifier character are the division cases; the keywords are the ones that read like
   identifiers and are not. Misjudging in the safe direction — calling a division a regex —
   would blank arithmetic, which contains no import statements either way. */
const REGEX_KEYWORDS =
  /(?:^|[^A-Za-z0-9_$])(?:return|typeof|instanceof|in|of|case|do|else|yield|await|new|delete|void)$/;

function startsRegex(tail) {
  const trimmed = tail.replace(/\s+$/, '');
  if (trimmed === '') return true;
  if (!/[A-Za-z0-9_$)\]]/.test(trimmed.at(-1))) return true;
  return REGEX_KEYWORDS.test(trimmed);
}

/* Consume `/.../flags`, honouring escapes and character classes — `[/]` is a literal
   slash, not the terminator. */
function emitRegex(source, start, emit, blank) {
  let index = start + 1;
  let inClass = false;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '\n') break;
    if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) {
      index += 1;
      break;
    }
    index += 1;
  }
  while (index < source.length && /[a-z]/.test(source[index])) index += 1;
  emit(blank(source.slice(start, index)), false);
  return index;
}

function closingQuote(source, start) {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '\n') return -1;
    if (char === quote) return index;
  }
  return -1;
}

/* The four ways a module specifier reaches a JS or TS file. The static form allows no
   quote, parenthesis or semicolon between the keyword and its `from`, which is what stops
   a multi-line import clause from running past its own statement into the next one. */
const SPECIFIER_PATTERNS = [
  /\b(?:import|export)\b[^;'"()]*?\bfrom\s*(['"])([^'"]*)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]*)\1/g,
  /\brequire\s*\(\s*(['"])([^'"]*)\1/g,
  /\bimport\s+(['"])([^'"]*)\1/g,
];

/* CSS has one, and only block comments to hide it in. */
const CSS_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1/g;

function scriptSpecifiers(source) {
  const { masked, literals } = maskLiterals(source);
  const found = new Set();
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of masked.matchAll(pattern)) {
      const captured = match[2];
      /* Anything not wrapped in MARK never was a string literal — a stray quote the masker
         passed through, most likely. It cannot be a specifier. */
      if (!captured.startsWith(MARK) || !captured.endsWith(MARK)) continue;
      found.add(literals[Number(captured.slice(1, -1))]);
    }
  }
  return [...found];
}

function stylesheetSpecifiers(source) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...withoutComments.matchAll(CSS_IMPORT_PATTERN)].map((match) => match[2]);
}

/* The package a specifier names, or null when nothing has to be installed for it to
   resolve. Subpaths are the reason this is a function and not a Set membership test:
   `@elirobinson/tokens/dials` and `@testing-library/jest-dom/vitest` are declared by their
   first one or two segments, never by the whole string. */
function packageOf(specifier) {
  if (/^[./#]/.test(specifier)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(specifier)) return null;
  const name = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
  return BUILTINS.has(name) ? null : name;
}

function undeclaredImports({ file, path, resolvable }) {
  const source = readFileSync(path, 'utf8');
  const specifiers = STYLESHEET.test(file)
    ? stylesheetSpecifiers(source)
    : scriptSpecifiers(source);

  return specifiers.filter((specifier) => {
    const name = packageOf(specifier);
    if (name === null || resolvable.has(name)) return false;
    return !PERMITTED.some((entry) => entry.file === file && entry.specifier === specifier);
  });
}

/* Every published file whose imports can be read, carrying the set of package names its
   own manifest promises a consumer will have on disk. */
function scannable() {
  return publishedPackages().flatMap(({ manifest, files }) => {
    const resolvable = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
      /* A package resolving its own name is npm's self-reference, which works in an
         install without being declared anywhere. */
      manifest.name,
    ]);

    return files
      .filter(({ file }) => SCRIPT.test(file) || STYLESHEET.test(file))
      .map(({ file, path }) => ({ file, path, package: manifest.name, resolvable }));
  });
}

describe('the dependency boundary', () => {
  const published = scannable();

  it('found published source files to check — run `pnpm build` first', () => {
    expect(published.length).toBeGreaterThan(0);
  });

  describe('no published file imports a package its manifest does not declare', () => {
    it.each(published)('$file', (entry) => {
      expect(
        undeclaredImports(entry),
        `${entry.file} imports these, and ${entry.package} declares none of them as a ` +
          'dependency, peerDependency or optionalDependency — so they do not resolve in a ' +
          "consumer's install. Either declare them, or stop publishing the file " +
          '(`files` in its package.json)',
      ).toEqual([]);
    });
  });

  /* The other half of the permitted table's double entry. Without this, a permission
     outlives the import it was granted for and sits in the file as a carve-out nobody can
     evaluate — which is how an exception list becomes the guard's largest hole. */
  it.each(PERMITTED)('the permission for $specifier in $file is still needed', (entry) => {
    const file = published.find((candidate) => candidate.file === entry.file);
    expect(file, `${entry.file} is permitted but is no longer published`).toBeDefined();

    const source = readFileSync(file.path, 'utf8');
    const specifiers = STYLESHEET.test(entry.file)
      ? stylesheetSpecifiers(source)
      : scriptSpecifiers(source);

    expect(
      specifiers,
      `${entry.file} no longer imports ${entry.specifier} — delete the permission ` +
        `(granted because: ${entry.reason})`,
    ).toContain(entry.specifier);
  });
});
