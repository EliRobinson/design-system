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

   What this gives up, stated plainly because #143 was closed once without
   stating it: no shot in this repo has ever contained a rendered code block,
   in either theme, and none does now. The block's border, radius, background
   and every syntax colour inside it are painted over before comparison. The
   visual suite cannot tell a readable code block from an unreadable one.

   That is a decision, not an oversight, and #143 is where it was made. The
   obvious alternative — narrow the mask and shoot one unmasked specimen —
   loses to the paragraph at the top of this comment: the flake is a property
   of the corner arc, so a specimen shot reintroduces it on the specimen. It
   would trade a silent gap for a noisy one, and #101 is this repo's own
   record of what a reliably-red suite does to the information a red carries.
   `regionBox` also wants a selector matching exactly one element, and the
   pages with code blocks have many, so any "Nth block" selector would drift
   under an edit above it — the same boundary shift #157 hit when three
   screenfuls moved from masked to compared in one commit.

   So code rendering is covered by apps/docs/src/lib/shiki-theme.test.ts and
   by nothing here. That file measures both themes against their own
   --bg-muted, pins each colour to a ramp step, asserts the markup carries
   both themes and commits to neither, and checks the site.css rules that
   choose between them — colour, weight and style. It is a good guard and it
   is not a visual one: if a token moves and the rendered result regresses in
   a way the scope table does not predict, no shot will see it. Do not assume
   this sweep has your back on code blocks. */
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
