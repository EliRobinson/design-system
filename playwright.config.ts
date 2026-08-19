import { defineConfig } from '@playwright/test';

import {
  NARROW_VIEWPORT,
  WIDE_VIEWPORT,
  defineVisualConfig,
} from '@elirobinson/ai-patterns/testing/visual-config';

import { DOCS_APP_DIR, DOCS_PORT, DOCS_URL } from './tests/visual/docs/routes';
import { STORYBOOK_DIR, STORYBOOK_PORT, STORYBOOK_URL } from './tests/visual/storybook/stories';

/* Visual regression config. See issue #65 for the decisions encoded here.

   The determinism contract — pinned clock, locale and timezone, exact pixel
   comparison, and the refusal to write baselines outside the pinned container —
   lives in `@elirobinson/ai-patterns/testing/visual-config`, because a baseline
   generated under different settings is worthless and a consumer copying those
   settings by hand is how they drift. What is left here is what only this repo
   can know: where its two builds are, and which projects it runs. */
export default defineConfig(
  defineVisualConfig({
    testDir: './tests/visual',

    /* The HTML report is for a person; this one is for the workflow. The
       `visual-accept` label and the recovery on main both need the exact set of
       failing shots, and reading it from a report beats parsing 14 minutes of
       log output. */
    reporter: [
      ['list'],
      ['html', { open: 'never' }],
      ['json', { outputFile: 'test-results/report.json' }],
    ],

    /* The Storybook build is served, not rebuilt per test. It has to exist
       before the specs are collected, because they enumerate stories from its
       index.json — which is why the build runs in `pretest:visual` rather than
       here. */
    webServer: [
      {
        command: `node scripts/serve-static.mjs ${STORYBOOK_DIR} ${STORYBOOK_PORT}`,
        url: STORYBOOK_URL,
        reuseExistingServer: !process.env.CI,
      },
      /* `next start`, not a static file server: every docs route is prerendered
         (assert-static-routes.mjs enforces it), but serving the output still
         needs Next's routing to map a URL onto the right prerendered document. */
      {
        command: `pnpm exec next start -p ${DOCS_PORT}`,
        cwd: DOCS_APP_DIR,
        url: DOCS_URL,
        reuseExistingServer: !process.env.CI,
      },
    ],

    /* Viewport is a project rather than a per-test setting, so a story's wide
       and narrow baselines live in separate directories and can't collide on
       name. */
    projects: [
      /* Asserts that the preset's settings do what they claim. Takes no
         baselines and needs no server, so it stays runnable on a bare
         checkout. */
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
      {
        name: 'docs-wide',
        testMatch: /docs\.spec\.ts$/,
        use: { viewport: WIDE_VIEWPORT },
      },
      /* Only the pages whose subject is responsive layout. They tag themselves
         @responsive, so the set is decided once, next to the routes it
         describes, rather than by a second list here that could disagree with
         it. */
      {
        name: 'docs-narrow',
        testMatch: /docs\.spec\.ts$/,
        grep: /@responsive/,
        use: { viewport: NARROW_VIEWPORT },
      },
    ],
  }),
);
