import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* cwd for the same reason as the Storybook enumerator: playwright.config.ts
   imports this and is transpiled to CJS, where import.meta is a syntax error. */
const repoRoot = process.cwd();

export const DOCS_APP_DIR = 'apps/docs';
export const DOCS_PORT = 3875;
export const DOCS_URL = `http://127.0.0.1:${DOCS_PORT}`;

/** Every page of the docs site, sorted so the run order is stable.
 *
 *  Read from Next's own prerender manifest rather than a list kept here. That
 *  file is exhaustive by construction: `apps/docs/scripts/assert-static-routes.mjs`
 *  fails the build if any route is server-rendered, so a route that exists is a
 *  route that is prerendered, and dynamic segments arrive already expanded by
 *  generateStaticParams. Add a page, get a baseline. */
export function docsRoutes(): string[] {
  const manifestPath = join(repoRoot, DOCS_APP_DIR, '.next/prerender-manifest.json');

  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf8');
  } catch {
    throw new Error(
      `No prerender manifest at ${manifestPath}.\n` +
        'The visual suite reads it to enumerate pages — build the docs app first ' +
        '(`pnpm test:visual` does this for you).',
    );
  }

  return Object.keys(JSON.parse(raw).routes ?? {})
    .filter(isVisualRoute)
    .sort((a, b) => a.localeCompare(b));
}

/* The manifest lists everything static, which is more than the pages a person
   can look at. */
function isVisualRoute(route: string): boolean {
  /* Next's internals: /_not-found and /_global-error. The 404 page is worth
     covering eventually, but through a route a visitor can actually reach. */
  if (route.startsWith('/_')) {
    return false;
  }

  /* Route handlers, not pages — llms.txt, llms-full.txt, and the 45 registry
     entries under /r/*.json. They serve text and have nothing to render. */
  if (route.endsWith('.txt') || route.endsWith('.json')) {
    return false;
  }

  /* These embed a staged artifact that compiles its JSX in the browser using
     Babel from unpkg — that is what the `unsafe-eval` allowance in
     next.config.mjs exists for. A live third-party fetch at render time is a
     flaky baseline and one that changes whenever unpkg serves a different
     build, so the panel is not something this suite can hold still. */
  if (route.startsWith('/brand/ui-kits/')) {
    return false;
  }

  return true;
}

/** Pages whose subject is responsive layout, and so are worth a second width.
 *
 *  Every page reflows, but on most of them a narrow capture would only restate
 *  what the wide one already covers, at the cost of another full-page image.
 *  The pattern pages document the reflow itself. */
export function isResponsiveRoute(route: string): boolean {
  return route.startsWith('/patterns/');
}

/** A filename-safe name for a route: `/` is `index`, `/a/b` is `a-b`. */
export function routeSlug(route: string): string {
  return route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '-');
}
