/* The bootstrap for every suite in this package that needs a real browser.
 * Not a published module: the `.test-helper.mjs` suffix matches neither
 * Vitest's include glob nor the one the package's `files` ships, so this is
 * neither collected as a suite nor shipped to a consumer.
 *
 * The launch guard, the teardown budget and the reasoning behind both live in
 * the repo's one shared bootstrap, tests/support/boot-browser.mjs (#402). This
 * file binds it to this package's own Vitest and Playwright.
 */

import { afterAll, describe } from 'vitest';

import {
  BROWSER_BUDGET,
  bootBrowser as bootShared,
} from '../../../../tests/support/boot-browser.mjs';

export { BROWSER_BUDGET };

/**
 * Bring up Chromium for the calling suite. Await it at a test file's top level.
 *
 * @param {string} label names the suite in the skip warning
 */
export function bootBrowser(label) {
  return bootShared(label, {
    vitest: { afterAll, describe },
    playwright: () => import('playwright'),
  });
}
