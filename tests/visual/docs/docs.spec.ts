import type { Page } from '@playwright/test';

import { DEFAULT_MASK, sweepPages } from '@elirobinson/ai-patterns/testing/visual-sweep';

import { expect, test } from '../fixtures';
import { DOCS_URL, docsRoutes, isResponsiveRoute } from './routes';

/* The docs site is what actually ships to people, so this covers what the
   Storybook sweep structurally cannot: components composed next to each other,
   the site chrome around them, and the token ramps rendered at page scale. */
sweepPages<Page>({
  test,
  expect,
  baseUrl: DOCS_URL,
  routes: docsRoutes(),

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
  mask: [...DEFAULT_MASK, 'pre.shiki'],

  /* The @responsive tag is how the narrow project selects its subset — see the
     `grep` on docs-narrow in playwright.config.ts. Tagging beats a second
     enumerator that could disagree with this one about which routes qualify. */
  title: (route, theme) => `${route} · ${theme}${isResponsiveRoute(route) ? ' @responsive' : ''}`,
});
