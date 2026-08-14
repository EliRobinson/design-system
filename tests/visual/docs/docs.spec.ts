import { stabilise } from '../capture';
import { expect, test } from '../fixtures';
import { THEMES, applyTheme } from '../theme';
import { DOCS_URL, docsRoutes, isResponsiveRoute, routeSlug } from './routes';

/* The docs site is what actually ships to people, so this covers what the
   Storybook sweep structurally cannot: components composed next to each other,
   the site chrome around them, and the token ramps rendered at page scale.

   Captures are full-page rather than viewport-sized. On an isolated story the
   viewport is the whole story; on a docs page most of the content is below the
   fold, and cropping it would leave exactly the small details this exists to
   catch outside the frame. */
for (const route of docsRoutes()) {
  for (const theme of THEMES) {
    /* The @responsive tag is how the narrow project selects its subset — see
       the `grep` on docs-narrow in playwright.config.ts. Tagging beats a second
       enumerator that could disagree with this one about which routes qualify. */
    const tag = isResponsiveRoute(route) ? ' @responsive' : '';

    test(`${route} · ${theme}${tag}`, async ({ page }) => {
      await applyTheme(page, theme);
      await page.goto(`${DOCS_URL}${route}`);

      /* Next hydrates after the document loads and the header's theme control
         mounts with it, so the markup keeps moving for a moment past
         domcontentloaded. stabilise() waits for the pixels rather than for any
         particular framework signal. */
      await page.waitForLoadState('load');
      await stabilise(page, { fullPage: true });

      await expect(page).toHaveScreenshot(`${routeSlug(route)}-${theme}.png`, {
        fullPage: true,

        /* Skeleton's shimmer is an eased infinite animation
           (`ds-skeleton-pulse`, 1.5s). stabilise() disables and restores
           animations once per capture and the assertion does so again, so the
           write path and the compare path run a different number of cycles and
           come to rest a hair apart — /components/skeleton failed by exactly
           one pixel on every run, and regenerating its baseline did not help.

           Masked rather than tolerated: a pixel budget wide enough to swallow
           this is also wide enough to hide a real colour regression, which is
           the thing this suite exists to catch.

           A selector, not a page list — it costs nothing on the pages that
           have no skeleton, and it covers any page that grows one later. The
           component's own appearance is still compared in full by the
           Storybook project, which captures the viewport rather than the whole
           page and does not show this. */
        mask: [page.locator('.ds-skeleton')],
      });
    });
  }
}
