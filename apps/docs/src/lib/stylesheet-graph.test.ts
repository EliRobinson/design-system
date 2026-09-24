import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/* The docs app's stylesheet graph, followed the way the bundler follows it:
 * every `.css` a source module imports, then every `@import` inside those, in
 * order. The bundler does not deduplicate a stylesheet reached twice — the
 * built CSS held three full copies of tokens.css before this was fixed (the
 * root layout, @elirobinson/react/styles.css, and elements.css) — and the
 * later copy wins every equal-specificity tie. That is how the elements.css
 * copy came to outrank site.css and paint the home hero eyebrow --fg-2 over the
 * --accent-ink-inverse site.css asked for.
 *
 * Read from source rather than from `.next`, so it runs without a build and
 * points at the import that added the copy. */

const APP = process.cwd();
const require = createRequire(join(APP, 'package.json'));

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
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

/** Every stylesheet reached from `file`, in import order, repeats included. */
function flatten(file: string, trail: string[] = []): string[] {
  if (trail.includes(file)) throw new Error(`@import cycle: ${[...trail, file].join(' -> ')}`);
  const css = stripComments(readFileSync(file, 'utf8'));
  const imports = [...css.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  return [
    file,
    ...imports.flatMap((specifier) => flatten(resolveCss(specifier, file), [...trail, file])),
  ];
}

const entries = sourceFiles(join(APP, 'src')).flatMap((module) =>
  [...readFileSync(module, 'utf8').matchAll(/^import\s+['"]([^'"]+\.css)['"];?$/gm)].map(
    (match) => ({ module, css: resolveCss(match[1], module) }),
  ),
);
const reached = entries.flatMap(({ css }) => flatten(css));

const TOKENS = realpathSync(require.resolve('@elirobinson/tokens/tokens.css'));
const REACT_STYLES = realpathSync(require.resolve('@elirobinson/react/styles.css'));
const SITE = realpathSync(join(APP, 'src/app/site.css'));
const PREFLIGHT = realpathSync(join(APP, 'src/app/preflight-scoped.css'));

describe('the docs stylesheet graph', () => {
  it('finds the root layout’s stylesheets, so the checks below are not vacuous', () => {
    expect(reached).toContain(SITE);
    expect(reached).toContain(TOKENS);
  });

  it('reaches tokens.css exactly once', () => {
    expect(reached.filter((file) => file === TOKENS)).toHaveLength(1);
  });

  it('reaches the component styles exactly once', () => {
    expect(reached.filter((file) => file === REACT_STYLES)).toHaveLength(1);
  });

  it('keeps the scoped reset before the tokens, and the chrome after them', () => {
    /* Preflight's place in `@layer base` is before tokens.css, so tokens.css's
       `a` rule wins the tie (elements-css.test.ts says why). site.css is the
       docs chrome and has to come after both the tokens and the components. */
    expect(reached.indexOf(PREFLIGHT)).toBeLessThan(reached.indexOf(TOKENS));
    expect(reached.indexOf(TOKENS)).toBeLessThan(reached.indexOf(SITE));
    expect(reached.indexOf(REACT_STYLES)).toBeLessThan(reached.indexOf(SITE));
  });
});
