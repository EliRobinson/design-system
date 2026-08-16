// The determinism contract a visual-regression suite has to hold, as a config
// you extend rather than one you copy.
//
//   // playwright.config.ts
//   import { defineConfig } from '@playwright/test'
//   import { defineVisualConfig } from '@elirobinson/ai-patterns/testing/visual-config'
//
//   export default defineConfig(
//     defineVisualConfig({
//       testDir: './tests/visual',
//       webServer: [{ command: 'pnpm start', url: 'http://127.0.0.1:3000' }],
//       projects: [{ name: 'wide', use: { viewport: WIDE_VIEWPORT } }],
//     }),
//   )
//
// Everything the preset sets is a decision about *reproducibility*, not about
// what to test: a pinned clock, a pinned locale and timezone, exact pixel
// comparison, and a refusal to write baselines outside a pinned container.
// What to test — test directory, servers, projects — stays with the consumer,
// because only they know it.
//
// Returns a plain object rather than calling Playwright's `defineConfig`, so
// @playwright/test stays an optional peer dependency and this module is
// importable (and `require()`-able, hence no top-level await) without it.

/** Set by the container wrapper that owns baseline generation. */
export const VISUAL_CONTAINER_ENV = 'DS_VISUAL_CONTAINER';

/* The two widths a suite draws from, exported so a Storybook sweep and a site
   sweep cannot drift apart on the numbers. A baseline is only comparable to
   another baseline taken at the same width. Frozen because a config is read by
   several modules and a shared mutable literal is a long-range bug. */
export const WIDE_VIEWPORT = Object.freeze({ width: 1280, height: 800 });

export const NARROW_VIEWPORT = Object.freeze({ width: 390, height: 844 });

/* The instant every visual run pretends it is.

   Mid-month and mid-day on purpose: a month boundary would make a date grid
   shift under a timezone slip, and a day boundary would do the same to any
   rendered date. Noon on the 15th is the furthest point from both.

   A component that calls a bare `new Date()` otherwise moves daily and its
   baseline rots overnight. Anything that seeds its own date — a story, a
   fixture — is worth keeping in this same month: a picker's view follows the
   selected date, so a fixed time in another month puts `today` outside the
   rendered grid and the `--today` style stops appearing in the baseline at
   all. That is a coverage loss nothing would report, since the snapshot stays
   perfectly stable. */
export const FIXED_TIME = new Date('2026-01-15T12:00:00.000Z');

/* Baselines grouped by project, so two sweeps never collide on a shared name
   and deleting one project's baselines is a single directory removal. */
export const SNAPSHOT_PATH_TEMPLATE =
  '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}';

/** Whether this process is the one allowed to write baselines. */
export function inVisualContainer(env = process.env) {
  return Boolean(env[VISUAL_CONTAINER_ENV]);
}

/**
 * Refuses to update baselines anywhere but the pinned container.
 *
 * Reading the flag off argv is crude, but the alternative is a rule that lives
 * only in a comment: `playwright test -u` on a laptop writes that laptop's font
 * rendering into the baselines, every one of them then fails in CI, and the
 * natural next move is to loosen `threshold` until they pass — which quietly
 * discards the whole guarantee.
 *
 * Called for you by defineVisualConfig; exported so a suite that builds its
 * config some other way can still install the guard.
 */
export function assertContainedBaselineUpdate({
  argv = process.argv,
  env = process.env,
  updateCommand = 'pnpm test:visual:update',
} = {}) {
  const updating = argv.some((arg) => arg === '-u' || arg.startsWith('--update-snapshots'));

  if (updating && !inVisualContainer(env)) {
    throw new Error(
      'Refusing to update baselines outside the pinned container.\n' +
        `Run \`${updateCommand}\` instead — it does this in the container CI uses.`,
    );
  }
}

/**
 * The determinism contract, merged with whatever the caller supplies.
 *
 * Top-level keys are a plain override. `use` and `expect` are merged one level
 * deep (and `expect.toHaveScreenshot` two), so adding a single option there
 * does not silently drop the rest of the contract — which is the failure mode
 * that makes a spread-based preset worse than no preset.
 */
export function defineVisualConfig(overrides = {}, guard = {}) {
  assertContainedBaselineUpdate(guard);

  const { use, expect, ...rest } = overrides;
  const env = guard.env ?? process.env;

  return {
    /* A subdirectory of test-results, not test-results itself. Playwright
       wipes and recreates its output directory on startup; when that directory
       is a bind mount, recreating it detaches it from the mount and every
       artifact lands inside the container instead of on the host — so a failing
       run leaves no diff images to look at. Cleaning a child of the mount
       works. */
    outputDir: './test-results/output',

    snapshotPathTemplate: SNAPSHOT_PATH_TEMPLATE,

    /* Playwright defaults this to 'missing', which silently *writes* any
       baseline that does not exist yet and reports it as a failure. On a laptop
       that bakes local font rendering into every new snapshot without anyone
       passing a flag — the argv guard never fires, because no flag was used.
       Outside the container a missing baseline is an error to report, never one
       to fill in.

       An explicit --update-snapshots still wins over this, which is how the
       container generates them; the guard above is what stops that on a host. */
    updateSnapshots: inVisualContainer(env) ? undefined : 'none',

    /* Playwright's 30s default is comfortable for a component and not for a
       page: a full-page capture of a long one takes seconds under emulation,
       and settling it needs at least two. */
    timeout: 180_000,

    fullyParallel: true,
    forbidOnly: Boolean(env.CI),

    /* No retries, deliberately. Retrying a screenshot comparison converts a
       genuine nondeterminism bug into an intermittent pass, which is the one
       failure mode this kind of suite exists to prevent. If a spec needs a
       retry to go green, the snapshot is not deterministic and the fix belongs
       in the spec. */
    retries: 0,

    reporter: env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

    ...rest,

    use: {
      viewport: WIDE_VIEWPORT,

      /* 1x keeps the PNGs at CSS-pixel dimensions. Retina capture would
         quadruple the byte count of every baseline for no extra signal, given
         the renderer is pinned. */
      deviceScaleFactor: 1,

      /* Pinned so nothing in a rendered date, number, or sort order depends on
         where the run happens. A component that passes an explicit locale to
         toLocaleDateString is fine either way, but a suite is not audited for
         that generally, and a timezone shift moves a fixed instant across a day
         boundary. */
      locale: 'en-US',
      timezoneId: 'UTC',

      /* A service worker left over from a previous build can serve stale
         assets, so a baseline would be compared against code that is no longer
         there. */
      serviceWorkers: 'block',

      ...use,
    },

    expect: {
      /* toHaveScreenshot does its own "two consecutive stable screenshots"
         check before comparing, and that check has its own 5s budget by
         default. A full-page capture of a long page takes over 2.5s under
         emulation, so two of them cannot fit — pages that are entirely stable
         fail with "Failed to take two consecutive stable screenshots". The page
         is fine; the stopwatch is too short.

         20s, not 60s. This budget also governs how long a *failing* comparison
         keeps retrying, and at 60s one flaky test spent a full minute
         re-capturing a long page — saturating an emulated VM shared by three
         workers and destabilising whatever ran beside it. The flake rate
         roughly quadrupled, which is the fix causing the problem it was meant
         to solve. */
      timeout: 20_000,

      ...expect,

      toHaveScreenshot: {
        /* Fast-forwards finite animations to their end state and cancels
           infinite ones to their first frame. The second half is what matters:
           a spinner or skeleton loops forever, so without this it samples an
           arbitrary frame. A reduced-motion media block does NOT solve this —
           clamping an infinite animation's duration to 0.01ms makes it cycle
           faster, not stop. */
        animations: 'disabled',

        /* Zero tolerance, in all three senses Playwright offers.

           `threshold` is the one that is easy to get wrong: it defaults to 0.2,
           a per-pixel YIQ colour distance under which two pixels are called
           equal. A one-step shift within a token ramp lands inside that default
           and passes, which is exactly the regression this suite exists to
           catch. Exact comparison is only viable because the renderer is pinned
           to a container; on native runners this would fail on font
           antialiasing alone. */
        threshold: 0,
        maxDiffPixels: 0,
        maxDiffPixelRatio: 0,

        ...expect?.toHaveScreenshot,
      },
    },
  };
}

/**
 * Freezes the page's clock at FIXED_TIME. Call before the test navigates, so
 * the very first script the page runs already sees it.
 *
 * setFixedTime, not clock.install: install replaces the timer queue wholesale,
 * which stalls React's scheduler and anything driven by setTimeout (a toast's
 * auto-dismiss, transition cleanup). What a baseline needs is a frozen
 * Date.now() with timers still running normally.
 */
export async function applyFixedClock(page, time = FIXED_TIME) {
  await page.clock.setFixedTime(time);
}
