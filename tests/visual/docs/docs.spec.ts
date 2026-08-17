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

  /* Just the package default — `.ds-skeleton`. Code blocks are deliberately
     NOT masked (issue #65).

     They were, briefly. The flake lived on the 4px corner arc of
     `pre.shiki`, where `--bg-muted` and `--border` sit ~12 sRGB levels apart
     and the coverage computed for the arc decides the byte in its last bit:
     23 failures across four runs, every one light, all on the same corner
     coordinates. Masking hid it, at the cost of never comparing the block's
     border, radius or background again.

     site.css now splits the rounded box from the scrolling element instead,
     so there is no rounded clip mask to compute and nothing to hide. Keeping
     the mask on top of that fix would throw away the coverage for no reason.

     If that split ever gets undone, this is the fallback:
       mask: [...DEFAULT_MASK, 'pre.shiki'] */
  mask: [...DEFAULT_MASK],

  /* The @responsive tag is how the narrow project selects its subset — see the
     `grep` on docs-narrow in playwright.config.ts. Tagging beats a second
     enumerator that could disagree with this one about which routes qualify. */
  title: (route, theme) => `${route} · ${theme}${isResponsiveRoute(route) ? ' @responsive' : ''}`,
});
