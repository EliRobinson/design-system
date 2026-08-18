import { nextStaticRoutes } from '@elirobinson/ai-patterns/testing/visual-sweep';

/* Where this repo's docs build lives, plus the two judgements that are ours
   rather than the preset's: which routes this site cannot hold still, and which
   ones are worth a second width. Enumeration and the general filtering (Next's
   internals, route handlers that serve text) come from
   `@elirobinson/ai-patterns/testing/visual-sweep`.

   Plain constants for the same reason as the Storybook module: playwright.config.ts
   imports this and is transpiled to CJS, where import.meta is a syntax error. */

export const DOCS_APP_DIR = 'apps/docs';
export const DOCS_PORT = 3875;
export const DOCS_URL = `http://127.0.0.1:${DOCS_PORT}`;

/** Every page of the docs site, sorted so the run order is stable.
 *
 *  `apps/docs/scripts/assert-static-routes.mjs` fails the build if any route is
 *  server-rendered, so a route that exists is a route in the manifest, and
 *  dynamic segments arrive already expanded by generateStaticParams. Add a
 *  page, get a baseline. */
export function docsRoutes(): string[] {
  return nextStaticRoutes({
    appDir: DOCS_APP_DIR,
    hint: '`pnpm test:visual` does this for you',

    /* These embed a staged artifact that compiles its JSX in the browser using
       Babel from unpkg — that is what the `unsafe-eval` allowance in
       next.config.mjs exists for. A live third-party fetch at render time is a
       flaky baseline and one that changes whenever unpkg serves a different
       build, so the panel is not something this suite can hold still. */
    exclude: (route) => route.startsWith('/brand/ui-kits/'),
  });
}

/** Pages whose subject is responsive layout, and so are worth a second width.
 *
 *  Every page reflows, but on most of them a narrow capture would only restate
 *  what the wide one already covers, at the cost of another full-page image.
 *  The pattern pages document the reflow itself. */
export function isResponsiveRoute(route: string): boolean {
  return route.startsWith('/patterns/');
}
