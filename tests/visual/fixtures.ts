import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/* The instant every visual run pretends it is.

   Mid-month and mid-day on purpose: a month boundary would make DatePicker's
   grid shift under a timezone slip, and a day boundary would do the same to
   any rendered date. Noon on the 15th is the furthest point from both.

   `today` inside DatePicker.tsx is a bare `new Date()`, so without this the
   component's highlighted cell moves daily and its baseline rots overnight.
   The stories should pin their own seed date as well — a story that is only
   deterministic under Playwright is still nondeterministic to review. */
export const FIXED_TIME = new Date('2026-01-15T12:00:00.000Z');

export const test = base.extend({
  page: async ({ page }, use) => {
    /* setFixedTime, not clock.install: install replaces the timer queue
       wholesale, which stalls React's scheduler and anything driven by
       setTimeout (Toast's auto-dismiss, transition cleanup). We want a frozen
       Date.now() with timers still running normally.

       Installed before the test navigates so the very first script the page
       runs already sees the fixed time. */
    await page.clock.setFixedTime(FIXED_TIME);
    await use(page);
  },
});
