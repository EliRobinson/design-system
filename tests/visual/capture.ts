import { type Page, expect } from '@playwright/test';

/* What every capture needs before it is worth comparing, shared by the
   Storybook and docs projects so a lesson learned in one applies to both.
   `fullPage` must match what the caller is about to assert on — see settle. */
export async function stabilise(page: Page, { fullPage = false } = {}): Promise<void> {
  /* Images are not covered by document.fonts.ready, and a capture taken while
     one is still decoding bakes a half-drawn page into the baseline. Cheap and
     targeted, where settle() below is the general safety net. */
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));

  /* Fonts resolve from the system stack rather than the network, but a capture
     taken before they are applied still measures different text metrics. */
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  /* A text caret blinks roughly twice a second, and it is not a CSS animation,
     so `animations: 'disabled'` does not touch it. Any page that focuses an
     input renders a bar that is present in some frames and absent in others —
     CommandPalette focuses its search field on open. Injected into the page so
     every capture of this document sees the same thing. */
  await page.addStyleTag({
    content: '*, *::before, *::after { caret-color: transparent !important; }',
  });

  await settle(page, fullPage);
}

/* Holds until two consecutive captures agree.

   Measured worth, not a guess. Removing this and relying on toHaveScreenshot's
   own stability check took a serial container run from 1 failure in 496 to
   roughly 8 in 223 — its longer, backing-off intervals catch late repaints that
   Playwright's tighter loop settles too early on.

   It is not free: each capture disables the page's animations and restores them
   afterwards, and the assertion that follows does the same, so the two paths
   run a different number of disable/restore cycles. On an eased infinite
   animation (`ds-skeleton-pulse`, 1.5s) that leaves them a hair apart, and the
   docs Skeleton page fails by exactly one pixel on every run — reproducibly,
   and not fixed by regenerating its baseline. One known-bad snapshot is the
   price of roughly thirty fewer flaky ones.

   `fullPage` has to match the assertion that follows. Stabilising the viewport
   while asserting on the whole page watches a different image than the one
   being written: everything below the fold could still be moving and this would
   call it settled.

   The timeout is generous because the capture itself is the slow part. Under
   emulation a full-page shot of a long docs page takes seconds, so a 10s budget
   was spent on three or four captures and expired before two could agree. */
async function settle(page: Page, fullPage: boolean): Promise<void> {
  const capture = () => page.screenshot({ animations: 'disabled', fullPage });

  let previous = await capture();

  await expect
    .poll(
      async () => {
        const next = await capture();
        const unchanged = next.equals(previous);
        previous = next;
        return unchanged;
      },
      { intervals: [100, 200, 400, 800], timeout: 60_000 },
    )
    .toBe(true);
}
