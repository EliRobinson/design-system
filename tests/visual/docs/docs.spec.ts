import type { Page } from '@playwright/test';

import { sweepPages } from '@elirobinson/ai-patterns/testing/visual-sweep';

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

  /* The @responsive tag is how the narrow project selects its subset — see the
     `grep` on docs-narrow in playwright.config.ts. Tagging beats a second
     enumerator that could disagree with this one about which routes qualify. */
  title: (route, theme) => `${route} · ${theme}${isResponsiveRoute(route) ? ' @responsive' : ''}`,
});
