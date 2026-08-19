/* Which shots a change could possibly have altered.
 *
 * Two layers, because neither alone is enough. Nx knows the import graph and
 * answers "is docs affected? is storybook affected?" authoritatively, but its
 * granularity is the project: any file under packages/react marks both
 * consumers affected, so it cannot tell Button from the whole library. The
 * file patterns below do that part, and they know nothing about imports.
 *
 * The dangerous failure here is the quiet one. A scope that is too wide costs
 * minutes; a scope that is too narrow produces a green pull request and stale
 * baselines on main, and nothing reports it. Every judgement call in this file
 * is therefore resolved by widening, and the two cases that cannot be resolved
 * at all throw. */

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

import { listShots } from './visual-shots.mjs';

const DOCS_PROJECT = 'docs';
const STORYBOOK_PROJECT = 'storybook';

const COMPONENT_FILE = /^packages\/react\/src\/components\/[^/]+\/([A-Z][A-Za-z0-9]*)\.(tsx|css)$/;
const STORY_FILE = /^apps\/storybook\/src\/stories\/([A-Z][A-Za-z0-9]*)\.stories\.tsx$/;
const DOCS_PAGE = /^apps\/docs\/src\/app\/\(docs\)\/(.+)\/page\.(mdx|tsx)$/;
const DEMO_FILE = /^apps\/docs\/src\/components\/demos\/([^/]+)\//;

/* A change to the *set* of things in the registry changes every docs page,
   because site-map.ts derives the sidebar from the component manifest and the
   sidebar is rendered on all of them. Measured, not assumed: PR #88 added six
   components and every one of the 142 pre-existing docs shots failed
   comparison, with zero story failures. */
const SIDEBAR_SOURCES = [
  'apps/docs/src/lib/site-map.ts',
  'apps/docs/src/lib/manifest.ts',
  'apps/docs/src/app/(docs)/layout.tsx',
  'apps/docs/src/components/docs/SiteHeader.tsx',
  'apps/docs/src/styles/site.css',
];

/** `git diff --name-status` output → changes, with renames split in two. */
export function parseNameStatus(raw) {
  const changes = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    const [status, ...paths] = line.split('\t');

    /* A rename is a delete and an add as far as the sidebar is concerned — the
       registry loses one entry and gains another — so it must not be collapsed
       into a modify. */
    if (status.startsWith('R') || status.startsWith('C')) {
      changes.push({ status: 'D', path: paths[0] });
      changes.push({ status: 'A', path: paths[1] });
      continue;
    }

    changes.push({ status: status[0], path: paths[0] });
  }

  return changes;
}

/** `DatePicker` → `components-datepicker--`, the storybook id prefix. */
function storyPrefix(name) {
  return `components-${name.toLowerCase()}--`;
}

/** `DatePicker` → `date-picker`, the docs route slug. */
function docsSlug(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/* The trailing ' · ' is the anchor: without it '/components/card' would also
   select '/components/card-group'. Titles are built as `<route> · <theme>`. */
function routePattern(route) {
  return `${route} · `;
}

export function scopeFor({ changes, affectedProjects, shots }) {
  const affected = new Set(affectedProjects);
  const docsAffected = affected.has(DOCS_PROJECT);
  const storybookAffected = affected.has(STORYBOOK_PROJECT);

  if (!docsAffected && !storybookAffected) {
    return {
      run: false,
      grep: null,
      reason: 'nx reports neither docs nor storybook affected, so no shot can have changed',
    };
  }

  const allRoutes = [...new Set(shots.filter((s) => s.route).map((s) => s.route))];
  const allStoryIds = [...new Set(shots.filter((s) => s.storyId).map((s) => s.storyId))];

  const patterns = new Set();
  const reasons = [];

  /* Layer 1a, before any narrowing: a registry change fans out to every docs
     page, so there is nothing left to narrow on that side. */
  const fanOut = changes.some(
    (change) =>
      SIDEBAR_SOURCES.includes(change.path) ||
      (change.status !== 'M' && COMPONENT_FILE.test(change.path)) ||
      (change.status !== 'M' && DOCS_PAGE.test(change.path)),
  );

  let docsNarrowable = docsAffected && !fanOut;

  if (docsAffected && fanOut) {
    for (const route of allRoutes) {
      patterns.add(routePattern(route));
    }
    reasons.push(
      'the component or page registry changed, and the sidebar derived from it is on every docs page',
    );
  }

  let storybookNarrowable = storybookAffected;

  for (const change of changes) {
    const component = COMPONENT_FILE.exec(change.path);
    if (component) {
      /* The narrowable flags are read from the enclosing scope rather than
         passed: they are reassigned by the fallback branches below, and a
         copy taken at call time would go stale mid-loop. */
      addComponent({ name: component[1], patterns, allStoryIds, allRoutes });
      continue;
    }

    const story = STORY_FILE.exec(change.path);
    if (story && storybookNarrowable) {
      addStories({ name: story[1], patterns, allStoryIds });
      continue;
    }

    const page = DOCS_PAGE.exec(change.path);
    if (page && docsNarrowable) {
      addRoute({ segment: page[1], patterns, allRoutes, source: change.path });
      continue;
    }

    const demo = DEMO_FILE.exec(change.path);
    if (demo && docsNarrowable) {
      addRoute({ segment: `components/${demo[1]}`, patterns, allRoutes, source: change.path });
      continue;
    }

    /* Unmappable. Whatever project it belongs to runs whole — never the world,
       never nothing. `styles.css`, `src/lib/`, `.storybook/`, packages/tokens
       and every config file land here. */
    if (isIn(change.path, 'apps/storybook') || isShared(change.path)) {
      if (storybookNarrowable) {
        storybookNarrowable = false;
        for (const id of allStoryIds) {
          patterns.add(`${id.split('--')[0]}--`);
        }
        reasons.push(`${change.path} cannot be narrowed, so every storybook shot runs`);
      }
    }

    if (isIn(change.path, 'apps/docs') || isShared(change.path)) {
      if (docsNarrowable) {
        docsNarrowable = false;
        for (const route of allRoutes) {
          patterns.add(routePattern(route));
        }
        reasons.push(`${change.path} cannot be narrowed, so every docs shot runs`);
      }
    }
  }

  if (patterns.size === 0) {
    return {
      run: false,
      grep: null,
      reason: 'nothing in the change maps to a shot',
    };
  }

  return {
    run: true,
    grep: [...patterns].join('|'),
    reason:
      reasons.length > 0 ? reasons.join('; ') : 'scoped to the components and routes that changed',
  };

  function addComponent({ name, patterns: out, allStoryIds: ids, allRoutes: routes }) {
    let matched = false;

    if (storybookNarrowable) {
      const prefix = storyPrefix(name);
      if (ids.some((id) => id.startsWith(prefix))) {
        out.add(prefix);
        matched = true;
      }
    } else if (storybookAffected) {
      matched = true;
    }

    const route = `/components/${docsSlug(name)}`;
    if (docsNarrowable) {
      if (routes.includes(route)) {
        out.add(routePattern(route));
        matched = true;
      }
    } else if (docsAffected) {
      matched = true;
    }

    /* Loud on purpose. A component renamed without its story or its docs slug
       following would otherwise stop being tested, and the run would be green.
       visual-sweep.test.mjs makes the same argument one layer down: a filter
       that quietly drops a page produces a suite that covers nothing and
       reports nothing. */
    if (!matched) {
      throw new Error(
        `visual-scope: '${name}' matched no story id '${storyPrefix(name)}*' and no route '${route}'. ` +
          'Either the component has no coverage, or its story title or docs slug has drifted from its ' +
          'filename. Refusing to silently narrow — fix the mapping or add the coverage.',
      );
    }
  }

  function addStories({ name, patterns: out, allStoryIds: ids }) {
    const prefix = storyPrefix(name);
    if (!ids.some((id) => id.startsWith(prefix))) {
      throw new Error(
        `visual-scope: story file for '${name}' matched no story id '${prefix}*'. ` +
          "The file's title has drifted from its filename.",
      );
    }
    out.add(prefix);
  }

  function addRoute({ segment, patterns: out, allRoutes: routes, source }) {
    const route = `/${segment}`;
    if (!routes.includes(route)) {
      throw new Error(
        `visual-scope: '${source}' maps to route '${route}', which the suite does not enumerate. ` +
          'Either the page is excluded from the sweep or the path convention has changed.',
      );
    }
    out.add(routePattern(route));
  }
}

function isIn(path, prefix) {
  return path.startsWith(`${prefix}/`);
}

/* Changes outside both apps that can still reach their rendering: the packages
   they consume, and the suite's own configuration. */
function isShared(path) {
  return (
    path.startsWith('packages/') ||
    path === 'playwright.config.ts' ||
    path.startsWith('tests/visual/')
  );
}

/** The projects Nx reports as affected between `base` and the working tree. */
export function affectedProjects(base, { cwd = process.cwd() } = {}) {
  const stdout = execFileSync(
    'pnpm',
    ['exec', 'nx', 'show', 'projects', '--affected', `--base=${base}`],
    {
      cwd,
      encoding: 'utf8',
    },
  );
  /* `nx show projects` prints a JSON array when its output is not a TTY. */
  return JSON.parse(stdout.trim());
}

/** The files changed between `base` and HEAD, as statuses and paths. */
export function changedFiles(base, { cwd = process.cwd() } = {}) {
  const stdout = execFileSync('git', ['diff', '--name-status', `${base}...HEAD`], {
    cwd,
    encoding: 'utf8',
  });
  return parseNameStatus(stdout);
}

/* CLI: prints the scope plan as JSON.

   realpathSync rather than a bare string compare: process.argv[1] can reach
   this file through a symlink (or a relative `./name` / bare-name
   invocation), in which case it never string-equals import.meta.filename
   even though it is the same file on disk. Resolving both to their real path
   first is what makes the comparison correct in all of those cases. */
const isEntrypoint = process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename;

if (isEntrypoint) {
  const base = process.argv[process.argv.indexOf('--base') + 1];
  if (!base || base === '--base') {
    throw new Error('visual-scope: --base <sha> is required');
  }

  const plan = scopeFor({
    changes: changedFiles(base),
    affectedProjects: affectedProjects(base),
    shots: listShots(),
  });

  process.stdout.write(JSON.stringify(plan));
}
