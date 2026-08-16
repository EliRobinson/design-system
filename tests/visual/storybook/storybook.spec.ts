import type { Page } from '@playwright/test';

import { storybookStories, sweepStorybook } from '@elirobinson/ai-patterns/testing/visual-sweep';

import { assertContracts } from '../contracts';
import { expect, test } from '../fixtures';
import { BUILD_HINT, STORYBOOK_DIR, STORYBOOK_URL } from './stories';

/* The whole Storybook sweep, from the build's own index.json. What stays here
   is only what is ours: where the build is, and the contract checks we run on
   top of the capture. Everything else — enumeration, theming, settling, the
   capture itself — is `@elirobinson/ai-patterns/testing/visual-sweep`, which is
   what a consuming app installs to get this same coverage over its own
   Storybook. */
sweepStorybook<Page>({
  test,
  expect,
  baseUrl: STORYBOOK_URL,
  stories: storybookStories({ storybookDir: STORYBOOK_DIR, hint: BUILD_HINT }),
  afterCapture: (page) => assertContracts(page),
});
