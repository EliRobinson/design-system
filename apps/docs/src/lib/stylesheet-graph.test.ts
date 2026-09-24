import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripComments } from './css-source';

/* The docs app's stylesheet graph, followed the way the bundler follows it:
 * every `.css` a module imports, then every `@import` inside those, in order.
 *
 * WHY ONE COPY MATTERS. The bundler inlines every `@import` it reaches and
 * does not drop a stylesheet it has already inlined elsewhere, so a stylesheet
 * reached twice is in the CSS twice — and the later copy wins every
 * equal-specificity tie against whatever sits between the two. The docs bundle
 * held three copies of tokens.css: the root layout imported it,
 * @elirobinson/react/styles.css opens with it, and elements.css imported it
 * again after site.css. That last copy outranked site.css, which is why the
 * home hero eyebrow painted --fg-2 over the --accent-ink-inverse site.css set.
 * The root layout now imports elements.css and then site.css, and nothing
 * else; tokens.css arrives once, through react/styles.css, inside elements.css.
 *
 * Read from source rather than from `.next`, so it runs without a build, and
 * every failure names the import chain that reached the file. */

const APP = process.cwd();
const require = createRequire(join(APP, 'package.json'));
const LAYOUT = join(APP, 'src/app/layout.tsx');

const show = (file: string) => relative(APP, file);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|mdx)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** A stylesheet specifier, resolved the way the bundler would. */
function resolveCss(specifier: string, from: string): string {
  if (specifier.startsWith('.')) return realpathSync(resolve(dirname(from), specifier));
  /* tsconfig.json's `@/*` path alias. */
  if (specifier.startsWith('@/')) return realpathSync(join(APP, 'src', specifier.slice(2)));
  try {
    return realpathSync(require.resolve(specifier, { paths: [dirname(from)] }));
  } catch {
    /* Packages that export a stylesheet only under the `style` condition, as
       tailwindcss does, are not reachable through require.resolve. */
    const direct = join(APP, 'node_modules', specifier);
    if (existsSync(direct)) return realpathSync(direct);
    throw new Error(`cannot resolve ${specifier} from ${from}`);
  }
}

/** The stylesheets a module imports. MDX code fences are examples, not imports. */
function cssImports(module: string): string[] {
  const source = readFileSync(module, 'utf8').replace(/^```[\s\S]*?^```/gm, '');
  return [...source.matchAll(/^import\s+['"]([^'"]+\.css)['"]/gm)].map((match) =>
    resolveCss(match[1], module),
  );
}

type Reached = { file: string; trail: string[] };

/** Every stylesheet reached from `file`, in import order, repeats included. */
function flatten(file: string, trail: string[]): Reached[] {
  if (trail.includes(file)) throw new Error(`@import cycle: ${[...trail, file].join(' -> ')}`);
  const css = stripComments(readFileSync(file, 'utf8'));
  const imports = [...css.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  return [
    { file, trail },
    ...imports.flatMap((specifier) => flatten(resolveCss(specifier, file), [...trail, file])),
  ];
}

/* Every stylesheet any module imports, each counted once however many modules
   import it: the bundler loads one stylesheet imported from two modules once.
   What it does not merge is two different stylesheets that each @import the
   same file, which is the case counted below. */
const importers = new Map<string, string>();
for (const module of sourceFiles(join(APP, 'src'))) {
  for (const css of cssImports(module)) if (!importers.has(css)) importers.set(css, module);
}
const reached = [...importers].flatMap(([css, module]) => flatten(css, [module]));

/* The root layout's chain alone, in the order the page loads it. */
const rootChain = cssImports(LAYOUT)
  .flatMap((css) => flatten(css, [LAYOUT]))
  .map(({ file }) => file);

const TOKENS = realpathSync(require.resolve('@elirobinson/tokens/tokens.css'));
const REACT_STYLES = realpathSync(require.resolve('@elirobinson/react/styles.css'));
const SITE = realpathSync(join(APP, 'src/app/site.css'));
const PREFLIGHT = realpathSync(join(APP, 'src/app/preflight-scoped.css'));

describe('the docs stylesheet graph', () => {
  it('finds the stylesheets it checks, so the checks below are not vacuous', () => {
    for (const file of [TOKENS, REACT_STYLES, SITE, PREFLIGHT]) {
      expect(rootChain, show(file)).toContain(file);
    }
  });

  it('reaches every stylesheet once, tokens.css included', () => {
    const hits = new Map<string, Reached[]>();
    for (const hit of reached) hits.set(hit.file, [...(hits.get(hit.file) ?? []), hit]);
    const repeated = [...hits.values()].filter((chains) => chains.length > 1);
    expect(
      repeated.map((chains) => show(chains[0].file)),
      repeated
        .flatMap((chains) => chains.map((hit) => [...hit.trail, hit.file].map(show).join(' -> ')))
        .join('\n'),
    ).toEqual([]);
  });

  it('loads the scoped reset before the tokens, and the chrome last', () => {
    /* Preflight's place in `@layer base` is before tokens.css, so tokens.css's
       `a` rule wins the tie (elements-css.test.ts says why). site.css is the
       docs chrome: nothing from the tokens, the components or the AI theme may
       load after it. */
    expect(rootChain.indexOf(PREFLIGHT)).toBeLessThan(rootChain.indexOf(TOKENS));
    expect(rootChain.at(-1)).toBe(SITE);
  });
});
