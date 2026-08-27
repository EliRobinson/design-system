/* The two build outputs every Playwright-backed check in `scripts/` reads.
 *
 * `visual-shots.test.mjs` holds every baseline on disk against the shot list
 * Playwright enumerates, and `visual-scope.test.mjs` applies a scoping pattern
 * with Playwright itself. Both spawn `playwright test --list`, which collects
 * stories from Storybook's `index.json` and routes from Next's prerender
 * manifest. So both need those two builds — and, less obviously, both need
 * them FINISHED.
 *
 * That ordering is `scripts`' `implicitDependencies` in project.json. `test`
 * already carries `dependsOn: ["^build", "build"]` from nx.json; naming
 * storybook and docs as dependencies is what makes `^build` resolve to
 * anything at all. Without it `nx show project scripts` reported an empty
 * `implicitDependencies` and `scripts:test` entered the graph with nothing to
 * wait for, so `nx run-many -t test` scheduled it beside `storybook:build` —
 * which is `storybook build -o storybook-static`, and empties that directory
 * before it refills it. Three outcomes, by timing:
 *
 *   - `index.json` is gone, so both suites SKIP and the run goes green having
 *     checked nothing;
 *   - it is mid-write, so `--list` exits non-zero and `execFileSync` throws;
 *   - it is the PREVIOUS build, so the shot list is a commit behind the
 *     baselines on disk and the parity assertion fails on the difference.
 *
 * The third is the one that reported as flaky rather than broken, because the
 * next run reads the build the last one finished writing. Measured on
 * 2026-08-26: a `storybook-static` predating #177's DatePicker `Open` story
 * computed 570 shots against 574 baselines, naming exactly that story's four.
 */

import { existsSync } from 'node:fs';

/* Relative to `scripts/`, which is the cwd of every suite in this directory
   (project.json sets it, and vitest's `include` is rooted there). */
export const REQUIRED_BUILDS = Object.freeze([
  '../apps/storybook/storybook-static/index.json',
  '../apps/docs/.next/prerender-manifest.json',
]);

/**
 * Whether both builds are present, for a `describe.skipIf`.
 *
 * Throws rather than returning false when Nx is the one running the suite.
 * Skipping is what keeps a bare `vitest run` usable on a checkout nobody has
 * built yet, and that is the only case it is for. Under Nx the two builds are
 * a declared dependency, so their absence means the declaration broke — and a
 * skip there is a false green in the one place that would report Playwright
 * changing how it resolves `{testFilePath}`, or a viewport project added to
 * playwright.config.ts and not to SPEC_FILE_BY_PROJECT. CI takes the Nx path
 * for both of its shapes: `nx affected -t build,test` on a pull request, and
 * `pnpm build && pnpm test` on main.
 */
export function buildsPresent({ exists = existsSync, env = process.env } = {}) {
  const missing = REQUIRED_BUILDS.filter((path) => !exists(path));

  if (missing.length === 0) {
    return true;
  }

  /* Nx sets this per task and it survives `pnpm run test` into vitest's
     workers, so it is a reliable "an ordered runner started me" signal.
     Verified with a throwaway `envprobe` target: `{"p":"scripts"}`. */
  if (env.NX_TASK_TARGET_PROJECT) {
    throw new Error(
      `visual-builds: ${missing.join(' and ')} missing under the Nx task ` +
        `'${env.NX_TASK_TARGET_PROJECT}'. scripts names storybook and docs in ` +
        "implicitDependencies so nx.json's `^build` orders both builds ahead of " +
        'this one; if that is still in scripts/project.json, then something ' +
        'removed the outputs while the suite was running. Skipping instead would ' +
        'silently drop the only checks that hold the shot list against Playwright.',
    );
  }

  return false;
}
