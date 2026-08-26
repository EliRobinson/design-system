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
  const routes = nextStaticRoutes({
    appDir: DOCS_APP_DIR,
    hint: '`pnpm test:visual` does this for you',

    /* These embed a staged artifact that compiles its JSX in the browser using
       Babel from unpkg — that is what the `unsafe-eval` allowance in
       next.config.mjs exists for. A live third-party fetch at render time is a
       flaky baseline and one that changes whenever unpkg serves a different
       build, so the panel is not something this suite can hold still. */
    exclude: (route) => route.startsWith('/brand/ui-kits/'),
  });

  /* The chrome shots borrow the route namespace (see CHROME_PREFIX), and two
     shots sharing a subject share a baseline path — the second would overwrite
     the first and the suite would report one comparison where it claims two.
     Cheap to assert here, where both lists are in hand, and invisible if it
     ever happened. */
  const collision = routes.find((route) => route.startsWith(`${CHROME_PREFIX}/`));
  if (collision) {
    throw new Error(
      `The docs site has a real route at '${collision}', which collides with the chrome shots' ` +
        `'${CHROME_PREFIX}/*' namespace. Move CHROME_PREFIX before this page ships.`,
    );
  }

  return routes;
}

/** The element every docs page shot is clipped to.
 *
 *  `main` and not `.docs-main`: the home page is outside the `(docs)` route
 *  group and renders a bare `<main>`, so keying on the shell's class would
 *  match nothing there — and `regionBox` throws on a selector that matches
 *  nothing rather than quietly framing the whole page. One selector that holds
 *  on every route is the point.
 *
 *  What this leaves out is the site chrome, which is the entire reason it
 *  exists — see CHROME_REGIONS. */
export const DOCS_CONTENT_REGION = 'main';

/** The route the chrome shots are taken on.
 *
 *  A docs route rather than `/`, because the sidebar only exists inside the
 *  `(docs)` group. A component page rather than a foundations one so the
 *  sidebar's `--active` state is captured on an entry that comes from the
 *  generated manifest — the half of the sidebar that moves. */
export const CHROME_ROUTE = '/components/button';

/** The route namespace the chrome shots occupy.
 *
 *  A path rather than a label, so a chrome shot is route-shaped everywhere
 *  downstream: `visual-scope.mjs` widening "every docs route" picks it up
 *  without a special case, and `visual-shots.mjs` maps it to a baseline path
 *  the same way it maps a page. No punctuation to mark it apart, because
 *  Playwright sanitises a snapshot name to `[A-Za-z0-9-]` and would rewrite
 *  `/_chrome/header` onto disk as `-chrome-header-…`, which nothing computing
 *  the path from the route would predict. `docsRoutes()` asserts no real page
 *  has claimed the namespace. */
export const CHROME_PREFIX = '/chrome';

/** The site chrome, shot once each instead of once per page.
 *
 *  The sidebar is deliberately captured as the visitor gets it: `site.css`
 *  clamps it to `calc(100vh - …)` with `overflow-y: auto`, so its box is about
 *  696px of a 4164px list. That is not a reduction — a `fullPage` capture
 *  clipped it to exactly the same box, so these shots compare the same sidebar
 *  pixels the 142 deleted baselines did. The rest of the list is covered where
 *  it is genuinely rendered in full, on `/components`.
 *
 *  Header and footer carry `@responsive` and so are shot at both widths; the
 *  sidebar is `display: none` under 960px, and a zero-sized region is a hard
 *  error in `regionBox` rather than a shot that silently compares nothing. */
export function chromeRegions(): { name: string; selector: string }[] {
  return [
    { name: 'header', selector: '.site-header' },
    { name: 'sidebar', selector: '.site-sidebar' },
    { name: 'footer', selector: '.site-footer' },
  ];
}

/** Chrome regions that survive the 960px breakpoint, and so are worth a second
 *  width. The sidebar and the header's primary nav are `display: none` below
 *  it; the header shell and the footer reflow and stay visible. */
export function isResponsiveChrome(name: string): boolean {
  return name !== 'sidebar';
}

/** Pages whose subject is responsive layout, and so are worth a second width.
 *
 *  Every page reflows, but on most of them a narrow capture would only restate
 *  what the wide one already covers, at the cost of another full-page image.
 *  The pattern pages document the reflow itself. */
export function isResponsiveRoute(route: string): boolean {
  return route.startsWith('/patterns/');
}
