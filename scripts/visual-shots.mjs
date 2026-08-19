/* Every shot the suite will take, and where its baseline lives.
 *
 * The enumeration is Playwright's own — `--list --reporter=json` — rather than
 * a second walk of the manifests. A second enumerator that could disagree with
 * the first is how a shot stops being covered without anyone noticing, which is
 * the failure `visual-sweep.test.mjs` was written to prevent one layer down.
 *
 * What is encoded here is only the mapping from a test title to a baseline
 * path. That mirrors the `name` callbacks in visual-sweep.mjs and the
 * SNAPSHOT_PATH_TEMPLATE in visual-config.mjs, and Task 2's disk cross-check
 * asserts the two still agree. */

import { execFileSync } from 'node:child_process';

/* `{testFilePath}` in the snapshot template resolves to the spec that owns the
   test, but both sweeps register their tests from inside visual-sweep.mjs, so
   the JSON listing attributes them to that file instead. The project name is
   what actually distinguishes them, and the mapping is fixed by
   playwright.config.ts. `smoke` is absent deliberately: it takes no baselines. */
export const SPEC_FILE_BY_PROJECT = {
  'storybook-wide': 'storybook/storybook.spec.ts',
  'storybook-narrow': 'storybook/storybook.spec.ts',
  'docs-wide': 'docs/docs.spec.ts',
  'docs-narrow': 'docs/docs.spec.ts',
};

const TEST_DIR = 'tests/visual';
const TITLE_SEPARATOR = ' · ';

/** `/patterns/forms` → `patterns-forms`; `/` → `index`. Mirrors `routeSlug`. */
function routeSlug(route) {
  return route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '-');
}

/** Every spec in a Playwright `--list --reporter=json` payload, flattened. */
function collectSpecs(node, out = []) {
  for (const spec of node.specs ?? []) {
    out.push(spec);
  }
  for (const suite of node.suites ?? []) {
    collectSpecs(suite, out);
  }
  return out;
}

/**
 * Shots from a `playwright test --list --reporter=json` payload.
 *
 * Throws on a project with no known spec file rather than skipping it. A new
 * viewport project added to playwright.config.ts and not added here would
 * otherwise vanish from every scoping decision silently.
 */
export function parseShots(listJson) {
  const shots = [];

  for (const spec of collectSpecs(listJson)) {
    for (const test of spec.tests ?? []) {
      const project = test.projectName;

      /* Takes no baselines, so it has nothing to select or regenerate. */
      if (project === 'smoke') {
        continue;
      }

      const specFile = SPEC_FILE_BY_PROJECT[project];
      if (!specFile) {
        throw new Error(
          `visual-shots: no spec file known for project '${project}'. ` +
            'Add it to SPEC_FILE_BY_PROJECT — a project this cannot place is a ' +
            'project that silently drops out of every scoping decision.',
        );
      }

      const [subject, rest] = splitTitle(spec.title, project);
      const theme = rest.split(' ')[0];
      const isRoute = subject.startsWith('/');
      const arg = isRoute ? routeSlug(subject) : subject;

      shots.push({
        project,
        title: spec.title,
        route: isRoute ? subject : null,
        storyId: isRoute ? null : subject,
        theme,
        baselinePath: `${TEST_DIR}/__screenshots__/${project}/${specFile}/${arg}-${theme}.png`,
      });
    }
  }

  return shots;
}

/* Titles are `<subject> · <theme>` with an optional ` @responsive` tag after
   the theme. Splitting on the separator rather than the last space keeps a
   subject containing a space from being misread. */
function splitTitle(title, project) {
  const at = title.indexOf(TITLE_SEPARATOR);
  if (at === -1) {
    throw new Error(
      `visual-shots: title '${title}' (project '${project}') has no ' · ' separator, ` +
        'so its theme cannot be read. The sweeps build every title this way.',
    );
  }
  return [title.slice(0, at), title.slice(at + TITLE_SEPARATOR.length)];
}

/** Runs Playwright's collection and parses it. Needs both apps built. */
export function listShots({ cwd = process.cwd() } = {}) {
  const stdout = execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return parseShots(JSON.parse(stdout));
}
