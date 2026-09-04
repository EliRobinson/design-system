/* The AI Elements section, checked against the packages it documents.

   Two failures this replaces. The first is a dead import path: every page in
   this section tells a consumer to write a specifier, and `@elirobinson/ai-
   elements` has no barrel, so a subpath that is a near miss produces a module
   error in their app and nothing at all in our build. Reading the specifiers out
   of the pages and resolving each one is the only check that covers the code a
   reader actually copies.

   The second is the failure the root rule exists for: a component list typed
   into prose. The roster belongs to vercel/ai-elements and changes on a
   re-sync, so a page naming one of the 74 vendored files is wrong from that
   commit onward, silently. The last test here is what makes generating the
   index load-bearing rather than merely tidy. */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ELEMENTS_TIERS, componentExports, elements, elementsByTier } from './ai-elements';
import { EXAMPLES, examplePath, readExample } from './examples';
import { siteSections } from './site-map';

const SECTION_DIR = join(process.cwd(), 'src/app/(docs)/ai-elements');

/** Every `page.mdx` in the section, as `[route, source]`. */
function sectionPages(): [string, string][] {
  return readdirSync(SECTION_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry): [string, string] => [
      `/ai-elements/${entry.name}`,
      readFileSync(join(SECTION_DIR, entry.name, 'page.mdx'), 'utf8'),
    ]);
}

/* The fenced code on a page, and nothing else.
   A page's own import lines are the site's business — the build resolves those
   or fails. What has to be checked here is the code a reader copies out, which
   is inside the fences. */
function fencedCode(source: string): string {
  return [...source.matchAll(/^```[\w-]*\n([\s\S]*?)^```/gm)].map((match) => match[1]).join('\n');
}

/* Specifiers a reader is being told to write, from the three forms the pages
   use: an ES import, a `@import` in a CSS block, and the `require()` inside the
   shell one-liners. Relative paths are somebody's own file and are skipped;
   everything else has to resolve. */
function specifiersIn(source: string): string[] {
  const found = new Set<string>();
  for (const [, specifier] of source.matchAll(/(?:from|@import)\s+['"]([^'"]+)['"]/g)) {
    found.add(specifier);
  }
  for (const [, specifier] of source.matchAll(/require\(\\?['"]([^'"\\]+)\\?['"]\)/g)) {
    found.add(specifier);
  }
  return [...found].filter((specifier) => !specifier.startsWith('.'));
}

/* The one specifier on these pages that names something this repo does not
   install: Tailwind is the consumer's framework, declared as a peer of
   `@elirobinson/ai-elements` and installed by them. It is excluded from the
   resolution check and checked as a peer instead, below — a page recommending a
   framework the package does not actually peer on would be worse than one
   recommending a module that fails to resolve. */
const CONSUMER_PEERS = new Set(['tailwindcss']);

/* Resolution runs in a real Node process, not in here.
 *
 * Vitest transforms this file for its SSR runtime, which rewrites `import.meta`
 * into an object with no `resolve` — so calling it here throws for every
 * specifier alike, including `react`, and a check that fails on everything is a
 * check that verifies nothing. Vite's own resolver is not the answer either: it
 * has aliases and extensions a consumer's bundler does not. The thing being
 * asserted is that Node, from this directory, can find what the page tells
 * somebody to import, so Node is what answers it.
 *
 * One subprocess for the whole file, memoised: the resolver is the slow part,
 * not the assertions. */
let resolutions: Record<string, string | null> | null = null;

function resolveAll(specifiers: string[]): Record<string, string | null> {
  const script = `
    const out = {};
    for (const specifier of ${JSON.stringify(specifiers)}) {
      try { out[specifier] = import.meta.resolve(specifier); } catch { out[specifier] = null; }
    }
    process.stdout.write(JSON.stringify(out));
  `;
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }),
  ) as Record<string, string | null>;
}

/** Resolved through the package's own `exports` map, from apps/docs. */
function resolves(specifier: string): boolean {
  resolutions ??= resolveAll(everySpecifier());
  const resolved = resolutions[specifier] ?? null;
  if (resolved === null) {
    return false;
  }
  /* Resolution answers from the exports map without touching the disk, so a
     subpath pointing at a file the package forgot to ship resolves happily. The
     consumer's failure is at load time; check for it here. */
  return existsSync(fileURLToPath(resolved));
}

/** Every specifier this file will ask about, gathered before the subprocess. */
function everySpecifier(): string[] {
  return [
    ...new Set([
      ...elements.map((entry) => entry.subpath),
      ...sectionPages().flatMap(([, source]) => specifiersIn(fencedCode(source))),
      ...EXAMPLES.flatMap(({ root, file }) => specifiersIn(readExample(root, file))),
    ]),
  ];
}

describe('the manifest the index is generated from', () => {
  it('sorts every entry into a tier the page renders', () => {
    /* ELEMENTS_TIERS is written down — it decides the order the tiers appear
       in — so a fourth namespace upstream adds would render nowhere. */
    const rendered = new Set(ELEMENTS_TIERS);
    for (const entry of elements) {
      expect(rendered.has(entry.tier), `${entry.subpath} is in no rendered tier`).toBe(true);
    }
  });

  it('renders a non-empty tier for each one it names', () => {
    for (const tier of ELEMENTS_TIERS) {
      expect(elementsByTier(tier).length, `the ${tier} tier renders empty`).toBeGreaterThan(0);
    }
  });

  it('publishes a resolvable subpath for every entry', () => {
    /* The manifest builds each subpath by string concatenation. That is fine
       until a tier is renamed or the exports map is narrowed, at which point it
       reports specifiers that resolve nowhere — and the whole point of the page
       is that a reader can copy one. */
    for (const entry of elements) {
      expect(resolves(entry.subpath), `${entry.subpath} does not resolve`).toBe(true);
    }
  });

  it('leaves a component with at least one export after the Props filter', () => {
    /* The filter is a suffix rule, so a namespace whose exports are all named
       `…Props` would render as a component with no API. */
    for (const entry of elements) {
      expect(componentExports(entry).length, `${entry.subpath} renders no exports`).toBeGreaterThan(
        0,
      );
    }
  });
});

describe('the specifiers the section tells a reader to write', () => {
  const pages = sectionPages();

  it('finds pages, and code inside them', () => {
    /* An extractor that has rotted passes every per-page assertion below by
       checking nothing, so the floor is asserted once for the section rather
       than per page — the examples page carries no fences at all, because its
       code is read out of real files by <ExampleSource>. */
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.flatMap(([, source]) => specifiersIn(fencedCode(source))).length).toBeGreaterThan(
      0,
    );
  });

  it.each(pages)('resolve on %s', (route, source) => {
    const specifiers = specifiersIn(fencedCode(source));
    for (const specifier of specifiers.filter((name) => !CONSUMER_PEERS.has(name))) {
      expect(resolves(specifier), `${route} shows '${specifier}', which does not resolve`).toBe(
        true,
      );
    }
  });

  it('recommend only frameworks the package actually peers on', () => {
    const peers = Object.keys(
      (
        JSON.parse(
          readFileSync(join(process.cwd(), '../../packages/ai-elements/package.json'), 'utf8'),
        ) as { peerDependencies: Record<string, string> }
      ).peerDependencies,
    );
    const shown = new Set(pages.flatMap(([, source]) => specifiersIn(fencedCode(source))));
    for (const peer of CONSUMER_PEERS) {
      expect(shown.has(peer), `nothing in the section imports '${peer}' any more`).toBe(true);
      expect(
        peers.includes(peer),
        `'${peer}' is no longer a peer of @elirobinson/ai-elements`,
      ).toBe(true);
    }
  });
});

describe('the worked examples', () => {
  it('are exactly the files the pages embed', () => {
    /* EXAMPLES is what the typecheck and this suite walk; <ExampleSource> is
       what a reader sees. A page embedding a file that is not in the list gets
       neither, and a file in the list that no page embeds is dead weight that
       still constrains the packages. */
    const embedded = new Set(
      sectionPages().flatMap(([, source]) =>
        [...source.matchAll(/<ExampleSource\s+root="([^"]+)"\s+file="([^"]+)"/g)].map(
          (match) => `${match[1]}/${match[2]}`,
        ),
      ),
    );
    const listed = new Set(EXAMPLES.map(({ root, file }) => `${root}/${file}`));
    expect([...embedded].sort()).toEqual([...listed].sort());
  });

  it.each(EXAMPLES)('$root/$file is on disk and imports only real specifiers', ({ root, file }) => {
    const path = examplePath(root, file);
    expect(existsSync(path), `${path} is missing`).toBe(true);

    const source = readExample(root, file);
    expect(source.length, `${file} is empty`).toBeGreaterThan(0);

    const specifiers = specifiersIn(source);
    expect(specifiers.length, `${file} imports nothing`).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(resolves(specifier), `${file} imports '${specifier}', which does not resolve`).toBe(
        true,
      );
    }
  });
});

/* The vendored subpaths a page may name, and why each one.
 *
 * Per specifier and with a reason, copying the shape
 * `packages/ai-patterns/src/artifacts/dependency-boundary.test.mjs` uses: a
 * permission is granted to the one import that was reasoned about, so the same
 * page naming a different component tomorrow is still red. The test below also
 * deletes this table's ability to rot, by failing when a permission stops being
 * used.
 *
 * All three are on the installation page, teaching the *shape* of a subpath —
 * one per namespace, which is the smallest set that shows what `components/`,
 * `ui/` and `lib/` mean. They are not a roster, and if upstream ever drops one
 * the specifier test above goes red first. */
const NAMEABLE = [
  {
    subpath: '@elirobinson/ai-elements/components/message',
    why: 'the components/ namespace, shown once so a reader knows what the index rows are',
  },
  {
    subpath: '@elirobinson/ai-elements/ui/button',
    why: 'the ui/ namespace, where the difference from @elirobinson/react has to be made',
  },
  { subpath: '@elirobinson/ai-elements/lib/utils', why: 'the lib/ namespace' },
];

describe('no page writes down the roster', () => {
  it('leaves it to the manifest, apart from three named exceptions', () => {
    /* The root rule, applied to the section where it is hardest to hold: the
       roster is upstream's, a re-sync moves it, and a list typed into prose is
       wrong from that commit onward with nothing to catch it. The index renders
       from the manifest, so a subpath appearing in a page source means somebody
       typed one.

       Matched on the import specifier rather than the bare name, because
       "message", "context" and "plan" are ordinary English and "conversation" is
       the subject of the section. A specifier is unambiguous. */
    const allowed = new Set(NAMEABLE.map((entry) => entry.subpath));
    for (const [route, source] of sectionPages()) {
      for (const entry of elements) {
        if (allowed.has(entry.subpath)) {
          continue;
        }
        expect(
          source.includes(entry.subpath),
          `${route} names ${entry.subpath} — the index is generated, so this list will rot`,
        ).toBe(false);
      }
    }
  });

  it.each(NAMEABLE)('still needs its permission for $subpath', ({ subpath }) => {
    const sources = sectionPages().map(([, source]) => source);
    expect(sources.some((source) => source.includes(subpath))).toBe(true);
  });
});

describe('the section is reachable', () => {
  it('appears in the site map with every page on disk', () => {
    const section = siteSections().find((s) => s.title === 'AI Elements');
    expect(section, 'no "AI Elements" section in the site map').toBeDefined();
    expect(section?.pages.map((page) => page.href).sort()).toEqual(
      sectionPages()
        .map(([route]) => route)
        .sort(),
    );
  });
});
