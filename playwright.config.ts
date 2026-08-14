import { defineConfig } from '@playwright/test';

import { WIDE_VIEWPORT } from './tests/visual/viewports';

/* Visual regression config. See issue #65 for the decisions encoded here.

   Only the smoke project so far — the Storybook and docs sweeps land in later
   steps. What this file settles now is the determinism contract every future
   project inherits, because a baseline generated under different settings is
   worthless. */
export default defineConfig({
  testDir: './tests/visual',

  projects: [
    /* Asserts that the settings below do what they claim. Takes no baselines
       and needs no server, so it stays runnable on a bare checkout. */
    { name: 'smoke', testMatch: /\.smoke\.spec\.ts$/ },
  ],

  /* Baselines are grouped by project so the Storybook and docs sweeps never
     collide on a shared name, and so deleting a project's baselines is one
     directory removal. */
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',

  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),

  /* No retries, deliberately. Retrying a screenshot comparison converts a
     genuine nondeterminism bug into an intermittent pass, which is the one
     failure mode this suite exists to prevent. If a spec needs a retry to go
     green, the snapshot is not deterministic and the fix belongs in the spec. */
  retries: 0,

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    viewport: WIDE_VIEWPORT,

    /* 1x keeps the PNGs at CSS-pixel dimensions. Retina capture would
       quadruple the byte count of every baseline for no extra signal, given
       the renderer is pinned. */
    deviceScaleFactor: 1,

    /* Pinned so nothing in a rendered date, number, or sort order depends on
       where the run happens. DatePicker passes an explicit 'en-US' to
       toLocaleDateString, but the components are not audited for that
       generally, and a timezone shift moves a fixed instant across a day
       boundary. */
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  expect: {
    toHaveScreenshot: {
      /* Fast-forwards finite animations to their end state and cancels
         infinite ones to their first frame. The second half is what matters:
         Spinner and Skeleton loop forever, so without this they sample an
         arbitrary frame. Note that the reduced-motion block in tokens.css
         does NOT solve this — clamping an infinite animation's duration to
         0.01ms makes it cycle faster, not stop. */
      animations: 'disabled',

      /* Zero tolerance, in all three senses Playwright offers.

         `threshold` is the one that is easy to get wrong: it defaults to 0.2,
         a per-pixel YIQ colour distance under which two pixels are called
         equal. A one-step shift within a token ramp can land inside that
         default and pass — which is precisely the regression in #60. Exact
         comparison is only viable because decision 1 pins the renderer to a
         container; on native runners this would fail on font antialiasing
         alone. */
      threshold: 0,
      maxDiffPixels: 0,
      maxDiffPixelRatio: 0,
    },
  },
});
