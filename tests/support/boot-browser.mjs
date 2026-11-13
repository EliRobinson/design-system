/* The one browser bootstrap for every Vitest suite in this repo that needs a
 * real browser: packages/tokens, packages/react/scripts, packages/ai-patterns
 * and apps/docs (#402). Each of those kept its own copy, and the copies
 * drifted: only one guarded a hung launch, only one could pick an engine.
 *
 * Not published, and it cannot be: it sits at the repo root, outside every
 * package folder, so no package's `files` can reach it. Nx sees it through the
 * `test` target's inputs in nx.json.
 *
 * It imports neither `vitest` nor `playwright`. The caller passes both in.
 * A bare import here would resolve from the repo root, not from the calling
 * package, and a second Vitest instance's `afterAll` binds to no file at all.
 */

/* Starting, opening and closing a browser are process-level operations that
   share the machine with whatever else is running. Vitest's 10s hook budget is
   sized for a unit test's setup, and `browser.close()` went past it whenever
   these suites ran alongside a build, failing a suite in which every assertion
   had already passed. Measured: launch 435ms, newPage 128ms, close 22ms idle;
   under a parallel monorepo build, close alone blew through 10s in three runs
   out of four. This budget is for the browser, not for the assertions: those
   stay on the default.

   60s is a bigger number, not a different mechanism. A CI runner slow enough
   could still blow it. The real fix would be treating teardown failure as
   non-fatal once every assertion has run; Vitest has no first-class way to say
   that, so this budget is the mitigation until it does. */
export const BROWSER_BUDGET = 60_000;

/**
 * Launch, or give up loudly.
 *
 * The launch runs during collection, where no timeout applies at all, so a
 * browser that never comes up would hang the run rather than skip it. A
 * late-arriving browser is closed instead of left parented to a worker that has
 * already moved on.
 *
 * @param {import('playwright').BrowserType} browserType
 * @param {string} engine
 * @param {number} budget
 */
async function launchWithin(browserType, engine, budget) {
  const launch = browserType.launch();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${engine}.launch() exceeded ${budget}ms`)), budget);
  });

  try {
    return await Promise.race([launch, deadline]);
  } catch (error) {
    /* Still in flight, and now nobody is waiting for it. Close it if it lands
       so the run does not leave an orphaned browser behind; the catch also
       keeps a rejected launch from surfacing as an unhandled rejection. */
    launch.then((late) => late.close()).catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Bring up a browser for the calling suite, register its teardown, and hand
 * back the `describe` to hang the browser-dependent cases off.
 *
 * Await it at a test file's top level, where Vitest is still collecting and
 * `afterAll` binds to that file. `describeBrowser` is `describe.skip` when no
 * browser came up, so a bare CI image skips loudly rather than fails.
 *
 * @param {string} label names the suite in the skip warning
 * @param {{
 *   vitest: { afterAll: typeof import('vitest').afterAll, describe: typeof import('vitest').describe },
 *   playwright: () => Promise<typeof import('playwright')>,
 *   engine?: 'chromium' | 'webkit' | 'firefox',
 *   budget?: number,
 * }} options `vitest` and `playwright` come from the caller, so they resolve
 *   from the caller's package. `budget` exists for this helper's own tests.
 * @returns {Promise<{ browser: import('playwright').Browser | null, describeBrowser: typeof import('vitest').describe }>}
 */
export async function bootBrowser(
  label,
  { vitest, playwright, engine = 'chromium', budget = BROWSER_BUDGET },
) {
  let browserType = null;
  let browser = null;
  let skipReason;

  try {
    browserType = (await playwright())[engine];
  } catch {
    skipReason = 'playwright is not installed';
  }

  if (browserType) {
    try {
      browser = await launchWithin(browserType, engine, budget);
    } catch (error) {
      skipReason = error.message;
    }
  }

  vitest.afterAll(async () => {
    await browser?.close();
  }, BROWSER_BUDGET);

  if (!browser) {
    console.warn(`Skipping ${label} tests: ${skipReason}`);
  }

  return { browser, describeBrowser: browser ? vitest.describe : vitest.describe.skip };
}
