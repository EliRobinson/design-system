/* The bootstrap shared by every suite in this package that needs a real
 * browser. Not a published module: the `.test-helper.mjs` suffix matches
 * neither Vitest's include glob nor the one the package's `files` ships, so
 * this is neither collected as a suite nor shipped to a consumer.
 *
 * It exists because the bootstrap was duplicated, and the copy drifted. The
 * budget below was reasoned out once, in the file that measured it, and then
 * omitted from the `afterAll` of the file that mirrored it — which is a defect
 * you cannot see by reading either file on its own. Registering the teardown
 * here makes that particular omission unrepresentable.
 */

import { afterAll, describe } from 'vitest';

/* Starting, opening and closing Chromium are process-level operations that
   share the machine with whatever else is running. Vitest's 10s hook budget is
   sized for a unit test's setup, and `browser.close()` went past it whenever
   these files ran alongside a build — failing a suite in which every assertion
   had already passed, which is the worst kind of red: it says nothing about the
   code and everything about the machine. Measured: launch 435ms, newPage 128ms,
   close 22ms idle; under a parallel monorepo build, close alone blew through
   10s in three runs out of four, and roughly one run in three for the preflight
   sweep once it started sharing the machine. This budget is for the browser, not
   for the assertions — those stay on the default, and none of them came within
   200ms of it even under that load. */
export const BROWSER_BUDGET = 60_000;

/* 60s is a bigger number, not a different mechanism — a CI runner slow enough
   could still blow it, and the same "all assertions passed, then the file went
   red" failure would recur. The actual fix would be treating teardown failure
   as non-fatal once every assertion has already run; Vitest has no first-class
   way to say that, so this budget is the mitigation until either that changes
   or this proves not to be enough. */

/**
 * Launch, or give up loudly.
 *
 * The launch runs during collection, where no timeout applies at all, so a
 * browser that never comes up would hang the run rather than skip it. A
 * late-arriving browser is closed instead of left parented to a worker that has
 * already moved on.
 */
async function launchWithin(chromium, budget) {
  const launch = chromium.launch();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`chromium.launch() exceeded ${budget}ms`)), budget);
  });

  try {
    const launched = await Promise.race([launch, deadline]);
    clearTimeout(timer);
    return launched;
  } catch (error) {
    clearTimeout(timer);
    /* Still in flight, and now nobody is waiting for it. Close it if it lands
       so the run does not leave an orphaned Chromium behind; the catch also
       keeps a rejected launch from surfacing as an unhandled rejection. */
    launch.then((late) => late.close()).catch(() => {});
    throw error;
  }
}

/**
 * Bring up a browser for the calling suite, register its teardown, and hand
 * back the `describe` to hang the browser-dependent cases off.
 *
 * Must be awaited at a test file's top level, where Vitest is still collecting
 * and `afterAll` binds to that file. `describeBrowser` is `describe.skip` when
 * no browser came up, so a bare CI image skips rather than fails — the suite is
 * the verification, and it should not be the thing that blocks an unrelated
 * change. `label` names the suite in the warning that says why it skipped.
 *
 * @param {string} label
 * @returns {Promise<{ browser: import('playwright').Browser | null, describeBrowser: typeof describe }>}
 */
export async function bootBrowser(label) {
  let chromium = null;
  let browser = null;
  let skipReason;

  try {
    ({ chromium } = await import('playwright'));
  } catch {
    skipReason = 'playwright is not installed';
  }

  if (chromium) {
    try {
      browser = await launchWithin(chromium, BROWSER_BUDGET);
    } catch (error) {
      skipReason = error.message;
    }
  }

  afterAll(async () => {
    await browser?.close();
  }, BROWSER_BUDGET);

  if (!browser) {
    console.warn(`Skipping ${label}: ${skipReason}`);
  }

  return { browser, describeBrowser: browser ? describe : describe.skip };
}
