import { defineConfig } from '@playwright/test';

import { STORYBOOK_DIR, STORYBOOK_PORT, STORYBOOK_URL } from './tests/visual/storybook/stories';
import { NARROW_VIEWPORT, WIDE_VIEWPORT } from './tests/visual/viewports';

/* Baselines are only meaningful when they come from the pinned container
   (issue #65, decision 1). Reading the flag off argv is crude, but the
   alternative is a rule that lives only in a comment: `playwright test -u` on
   a laptop writes macOS font rendering into the baselines, every one of them
   then fails in CI, and the natural next move is to loosen `threshold` until
   they pass — which quietly discards the whole guarantee.

   Set by scripts/visual-container.mjs; there is no reason to set it by hand. */
const updatingSnapshots = process.argv.some(
  (arg) => arg === '-u' || arg.startsWith('--update-snapshots'),
);

if (updatingSnapshots && !process.env.DS_VISUAL_CONTAINER) {
  throw new Error(
    'Refusing to update baselines outside the pinned container.\n' +
      'Run `pnpm test:visual:update` instead — it does this in the container CI uses.',
  );
}

/* Visual regression config. See issue #65 for the decisions encoded here.

   Only the smoke project so far — the Storybook and docs sweeps land in later
   steps. What this file settles now is the determinism contract every future
   project inherits, because a baseline generated under different settings is
   worthless. */
export default defineConfig({
  testDir: './tests/visual',

  /* The Storybook build is served, not rebuilt per test. It has to exist before
     the specs are collected, because they enumerate stories from its index.json
     — which is why the build runs in `pretest:visual` rather than here. */
  webServer: {
    command: `node scripts/serve-static.mjs ${STORYBOOK_DIR} ${STORYBOOK_PORT}`,
    url: STORYBOOK_URL,
    reuseExistingServer: !process.env.CI,
  },

  /* Viewport is a project rather than a per-test setting, so a story's wide and
     narrow baselines live in separate directories and can't collide on name. */
  projects: [
    /* Asserts that the settings below do what they claim. Takes no baselines
       and needs no server, so it stays runnable on a bare checkout. */
    { name: 'smoke', testMatch: /\.smoke\.spec\.ts$/ },
    {
      name: 'storybook-wide',
      testMatch: /storybook\.spec\.ts$/,
      use: { viewport: WIDE_VIEWPORT },
    },
    {
      name: 'storybook-narrow',
      testMatch: /storybook\.spec\.ts$/,
      use: { viewport: NARROW_VIEWPORT },
    },
  ],

  /* Baselines are grouped by project so the Storybook and docs sweeps never
     collide on a shared name, and so deleting a project's baselines is one
     directory removal. */
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',

  /* Playwright defaults this to 'missing', which silently *writes* any baseline
     that doesn't exist yet and reports it as a failure. On a laptop that bakes
     macOS font rendering into every new snapshot without anyone passing a flag
     — the argv guard above never fires, because no flag was used. Outside the
     container a missing baseline is an error to report, never one to fill in.

     An explicit --update-snapshots still wins over this, which is how the
     container generates them; the guard above is what stops that on a host. */
  updateSnapshots: process.env.DS_VISUAL_CONTAINER ? undefined : 'none',

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

    /* From Playwright's component-testing guidance, which applies to any suite
       that navigates to a gallery page: a service worker left over from a
       previous build can serve stale assets, so a baseline would be compared
       against code that is no longer there. Nothing here registers one today —
       this keeps that true. */
    serviceWorkers: 'block',
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
