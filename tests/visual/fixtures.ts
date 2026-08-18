import { test as base } from '@playwright/test';

import { applyFixedClock } from '@elirobinson/ai-patterns/testing/visual-config';

export { expect } from '@playwright/test';

/* Freezes the clock for every test in this suite. The sweeps in
   `@elirobinson/ai-patterns/testing/visual-sweep` also apply it per test, so a
   consumer needs no fixture at all; this covers the specs written by hand here,
   and setting the same fixed instant twice changes nothing. */
export const test = base.extend({
  page: async ({ page }, run) => {
    /* Installed before the test navigates so the very first script the page
       runs already sees the fixed time. */
    await applyFixedClock(page);
    await run(page);
  },
});
