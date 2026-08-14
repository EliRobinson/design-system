import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { THEMES, applyTheme } from '../theme';
import { stories, storyUrl } from './stories';

/** Resolves once the story has actually rendered. */
async function waitForStory(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.getElementById('storybook-root');
    return Boolean(root && root.children.length > 0);
  });

  /* Fonts resolve from the system stack rather than the network, but a capture
     taken before they are applied still measures different text metrics. */
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  /* A text caret blinks roughly twice a second, and it is not a CSS animation,
     so `animations: 'disabled'` does not touch it. Any story that focuses an
     input renders a bar that is present in some frames and absent in others —
     CommandPalette focuses its search field on open, and its baseline passed
     generation and then failed the very next run.

     settle() cannot save this either: two consecutive captures can agree
     purely because both happened to land in the same blink phase, which fixes
     that phase into the baseline and leaves every later run a coin flip.
     Injected into the page rather than passed to toHaveScreenshot, so the
     settle captures and the asserted one see exactly the same document. */
  await page.addStyleTag({
    content: '*, *::before, *::after { caret-color: transparent !important; }',
  });

  await settle(page);
}

/* Holds until two consecutive captures agree.

   Without this, three snapshots — badge--signal dark, button--accent light,
   button--large light — failed on every run after the one that generated them,
   by 377 to 1082 pixels of text. Always the same three, so not flake: the
   baseline itself was written from a frame taken before the page had settled,
   and every honest re-render then disagreed with it. Comparison retries until
   stable; writing a new baseline does not, so the two paths could capture
   different states of the same story.

   Deliberately not a fixed delay, and deliberately not a diagnosis of what is
   still moving a few hundred milliseconds in — waiting for the pixels to stop
   changing is true regardless of the cause, where a guess at the cause would
   only hold until the next one. */
async function settle(page: Page): Promise<void> {
  let previous = await page.screenshot({ animations: 'disabled' });

  await expect
    .poll(
      async () => {
        const next = await page.screenshot({ animations: 'disabled' });
        const unchanged = next.equals(previous);
        previous = next;
        return unchanged;
      },
      { intervals: [100, 200, 400, 800], timeout: 10_000 },
    )
    .toBe(true);
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
    });
  }
}
