import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

/* Separate from the repo's root playwright.config.ts on purpose. That one is
   the visual-regression suite: it pins a clock, a locale and a timezone,
   compares screenshots exactly, and refuses to write baselines outside a pinned
   container. None of that applies here — this suite takes no screenshots and
   asserts on measured geometry and computed colour, both of which are settled
   by the layout engine rather than by the rasteriser. That is what makes it
   runnable on a developer machine, where the visual suite is not. */

export const HARNESS_DIR = fileURLToPath(new URL('./dist', import.meta.url));
export const HARNESS_PORT = 4319;
export const HARNESS_URL = `http://127.0.0.1:${HARNESS_PORT}`;

export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: /\.a11y\.spec\.ts$/,
  /* The four checks scroll the page and focus controls. Neither survives two
     tests sharing a tab, and both are cheap, so a worker per core with a fresh
     page per test is the right shape. */
  fullyParallel: true,
  reporter: [['list'], ['json', { outputFile: 'a11y-results.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: HARNESS_URL,
    /* After the device preset, so it wins. Fixed, so a measurement is
       reproducible, and wide enough that nothing under audit is laid out in its
       narrow form by accident. */
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: `node ../../../scripts/serve-static.mjs ${HARNESS_DIR} ${HARNESS_PORT}`,
    url: HARNESS_URL,
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    reuseExistingServer: true,
  },
});
