import type { Page } from '@playwright/test';

import {
  DEFAULT_MASK,
  sweepChrome,
  sweepPages,
} from '@elirobinson/ai-patterns/testing/visual-sweep';

import { expect, test } from '../fixtures';
import {
  CHROME_PREFIX,
  CHROME_ROUTE,
  DOCS_CONTENT_REGION,
  DOCS_URL,
  chromeRegions,
  docsRoutes,
  isResponsiveChrome,
  isResponsiveRoute,
} from './routes';

/* Shiki code blocks are masked, on top of the package default.
   `--bg-muted` and `--border` sit about 12 sRGB levels apart, and the block's
   4px corner arc blends across that band, so the coverage computed for the
   arc decides the byte in its last bit. Two runs of the identical commit
   disagreed there and nowhere else — 23 failures over four runs, every one
   light, all on the same corner coordinates. Squaring the corner removed it
   on 11 of 11 pages across two runs, which is what identified the arc; this
   masks it instead, so the docs keep their rounded code blocks.

   Docs-specific on purpose. DEFAULT_MASK carries `.ds-skeleton`, a
   design-system class every consumer has; `pre.shiki` is this site's
   syntax highlighter and has no business in a published default.

   What this gives up: the code block's own border, radius and background
   stop being compared. The syntax colours inside it were never a design
   system concern, and the block's styling is three declarations in
   site.css rather than a component. */
const MASK = [...DEFAULT_MASK, 'pre.shiki'];

/* The docs site is what actually ships to people, so this covers what the
   Storybook sweep structurally cannot: components composed next to each other
   and the token ramps rendered at page scale.

   Clipped to the content region rather than framed whole. The sidebar derives
   from one registry and renders on every page, so under full-page framing a
   single added component moved pixels in all 142 shots at once — the suite
   reporting one fact 142 times, which is why the project was switched off in
   #101. With the chrome outside the frame that fan-out is not merely tolerated,
   it is structurally impossible: a sidebar cannot fail a shot it is not in.
   The chrome itself is covered below. See docs/agents/visual-regression.md,
   "How docs-wide is framed". */
sweepPages<Page>({
  test,
  expect,
  baseUrl: DOCS_URL,
  routes: docsRoutes(),
  region: DOCS_CONTENT_REGION,
  mask: MASK,

  /* The @responsive tag is how the narrow project selects its subset — see the
     `grep` on docs-narrow in playwright.config.ts. Tagging beats a second
     enumerator that could disagree with this one about which routes qualify. */
  title: (route, theme) => `${route} · ${theme}${isResponsiveRoute(route) ? ' @responsive' : ''}`,
});

/* The other half of the clip. Header, nav, sidebar and footer left every page
   frame above, so they get their own shots — a handful, on one route, instead
   of one per page. One sidebar shot is the amount of sidebar coverage this
   site warrants; 142 was a side effect of full-page framing, never a decision.

   These are what an added or removed component is now expected to fail: the
   sidebar entry it inserts is a real pixel change and it belongs in exactly one
   baseline. */
sweepChrome<Page>({
  test,
  expect,
  baseUrl: DOCS_URL,
  route: CHROME_ROUTE,
  regions: chromeRegions(),
  mask: MASK,
  title: (region, theme) =>
    `${CHROME_PREFIX}/${region.name} · ${theme}${isResponsiveChrome(region.name) ? ' @responsive' : ''}`,
});
