import type { Page } from '@playwright/test';

import { stabilise } from '../capture';
import { assertContracts } from '../contracts';
import { expect, test } from '../fixtures';
import { THEMES, applyTheme } from '../theme';
import { stories, storyUrl } from './stories';

/** Resolves once the story has actually rendered. */
async function waitForStory(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.getElementById('storybook-root');
    return Boolean(root && root.children.length > 0);
  });

  await stabilise(page);
}

for (const story of stories()) {
  for (const theme of THEMES) {
    test(`${story.id} · ${theme}`, async ({ page }) => {
      await applyTheme(page, theme);
      await page.goto(storyUrl(story.id));
      await waitForStory(page);

      /* The viewport, not #storybook-root.

         Clipping to the root reads as the tidier choice and issue #65 originally
         called for it, but two things killed it. Overlays portal into
         document.body (overlay/anchoredOverlay.tsx), so a clipped capture keeps
         the trigger and silently drops the panel — the positioning and elevation
         that make an overlay worth testing at all. And deciding per story
         whether anything rendered outside the root is not stable: Storybook's
         boot leaves briefly-sized siblings, so the same story chose different
         capture targets on different runs, which cannot produce a baseline.

         The size argument for clipping did not survive measurement either. A
         full-viewport story here is 5-7KB, because it is a near-empty page of
         flat colour — not the 50-150KB that reasoning assumed. That estimate
         was about tall docs pages, and it still holds there.

         A story taller than the viewport is cropped by this. None in the
         proving set are; step 5 will say whether any of the other 70 are. */
      await expect(page).toHaveScreenshot(`${story.id}-${theme}.png`);

      /* After the screenshot, deliberately: the contracts focus controls to
         see whether focusing changes anything, so running them first would
         bake a focus ring into the baseline. Reusing this page load rather
         than taking a second one keeps the whole suite roughly its current
         length. */
      await assertContracts(page);
    });
  }
}
