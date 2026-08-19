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

import { escapeRegExp } from './visual-missing.mjs';
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
  'apps/docs/src/components/SiteHeader.tsx',
  'apps/docs/src/app/site.css',
];

/* Nx's import graph cannot see these edges: playwright.config.ts and the
   suite's own runner under packages/ai-patterns/src/testing/ are Playwright's
   configuration, not something docs or storybook import. Changing the
   viewport, maxDiffPixels, the snapshot path template, or the sweep's masking
   logic alters every screenshot, so a change here must force both projects
   affected even when `nx show projects --affected` reports neither — its
   dependency graph has no edge to follow. (packages/ai-patterns/src/testing/
   is also covered by the general `packages/` prefix below, once this gate
   lets execution reach it; playwright.config.ts and tests/visual/ are not
   under packages/, so without this they would never even get that far.) */
const SUITE_CONFIG_EXACT = ['playwright.config.ts'];
const SUITE_CONFIG_PREFIXES = ['tests/visual/', 'packages/ai-patterns/src/testing/'];

function touchesSuiteConfig(changes) {
  return changes.some(
    (change) =>
      SUITE_CONFIG_EXACT.includes(change.path) ||
      SUITE_CONFIG_PREFIXES.some((prefix) => change.path.startsWith(prefix)),
  );
}

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
  return `components-${escapeRegExp(name.toLowerCase())}--`;
}

/** `DatePicker` → `date-picker`, the docs route slug. */
function docsSlug(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/* The trailing ' · ' is the anchor: without it '/components/card' would also
   select '/components/card-group'. Titles are built as `<route> · <theme>`. */
function routePattern(route) {
  return `${escapeRegExp(route)} · `;
}

/** An id's `<namespace>-<segment>` prefix, as a pattern anchored on `--`. */
function idPrefix(id) {
  return `${escapeRegExp(id.split('--')[0])}--`;
}

/**
 * The story-id prefix for a `*.stories.tsx` file's base name, searching every
 * namespace present in `allStoryIds` rather than assuming `components-`.
 *
 * A story file's title is free text (`title: 'Patterns/Marketing'`) and is
 * not required to match its filename exactly — `MarketingPattern.stories.tsx`
 * can title itself `Patterns/Marketing`, producing ids like
 * `patterns-marketing--hero-section`. So the match falls back to "the file's
 * lower-cased name starts with the id's segment" — but only as a fallback.
 *
 * An exact match (segment === filename) always wins first: `ButtonGroup`
 * exactly matches a `components-buttongroup--*` segment, and must not lose to
 * `components-button--*`, whose segment is merely a *prefix* of `buttongroup`
 * and would otherwise win or lose depending on which id the shot list happens
 * to enumerate first. When no exact match exists, the longest prefix match
 * wins, for the same reason — a shorter sibling's segment being a prefix of
 * the real match must never decide the answer by enumeration order. Either
 * way the result is independent of `allStoryIds`' order.
 */
function findStoryPrefix(name, allStoryIds) {
  const lower = name.toLowerCase();

  let exactId = null;
  let bestPrefixId = null;
  let bestPrefixLength = -1;

  for (const id of allStoryIds) {
    const doubleDash = id.indexOf('--');
    const dash = id.indexOf('-');
    if (doubleDash === -1 || dash === -1) {
      continue;
    }

    const segment = id.slice(dash + 1, doubleDash);
    if (!segment) {
      continue;
    }

    if (segment === lower) {
      /* Exact match is the maximum possible prefix length too (a segment
         cannot be a prefix of `lower` and longer than `lower`), so no later
         id in the loop can outrank it — safe to stop here. */
      exactId = id;
      break;
    }

    if (lower.startsWith(segment) && segment.length > bestPrefixLength) {
      bestPrefixId = id;
      bestPrefixLength = segment.length;
    }
  }

  const winner = exactId ?? bestPrefixId;
  return winner ? idPrefix(winner) : null;
}

export function scopeFor({ changes, affectedProjects, shots }) {
  const affected = new Set(affectedProjects);
  const forcedBySuiteConfig = touchesSuiteConfig(changes);
  const docsAffected = affected.has(DOCS_PROJECT) || forcedBySuiteConfig;
  const storybookAffected = affected.has(STORYBOOK_PROJECT) || forcedBySuiteConfig;

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
  const unmapped = [];

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
      addComponent({
        name: component[1],
        patterns,
        allStoryIds,
        allRoutes,
        status: change.status,
      });
      continue;
    }

    const story = STORY_FILE.exec(change.path);
    if (story && storybookNarrowable) {
      addStories({ name: story[1], patterns, allStoryIds, status: change.status });
      continue;
    }

    const page = DOCS_PAGE.exec(change.path);
    if (page && docsNarrowable) {
      addRoute({
        segment: page[1],
        patterns,
        allRoutes,
        source: change.path,
        status: change.status,
      });
      continue;
    }

    const demo = DEMO_FILE.exec(change.path);
    if (demo && docsNarrowable) {
      addRoute({
        segment: `components/${demo[1]}`,
        patterns,
        allRoutes,
        source: change.path,
        status: change.status,
      });
      continue;
    }

    /* Unmappable by file pattern. Whatever project it belongs to runs whole —
       never the world, never nothing. `styles.css`, `src/lib/`, `.storybook/`,
       packages/tokens and every config file land here. */
    const inStorybookOrShared = isIn(change.path, 'apps/storybook') || isShared(change.path);
    const inDocsOrShared = isIn(change.path, 'apps/docs') || isShared(change.path);

    if (inStorybookOrShared && storybookNarrowable) {
      storybookNarrowable = false;
      for (const id of allStoryIds) {
        patterns.add(idPrefix(id));
      }
      reasons.push(`${change.path} cannot be narrowed, so every storybook shot runs`);
    }

    if (inDocsOrShared && docsNarrowable) {
      docsNarrowable = false;
      for (const route of allRoutes) {
        patterns.add(routePattern(route));
      }
      reasons.push(`${change.path} cannot be narrowed, so every docs shot runs`);
    }

    /* Not even recognized as belonging to either app or a shared package —
       e.g. pnpm-lock.yaml, package.json, nx.json, tsconfig.base.json. Nx may
       still have marked docs and/or storybook affected by it (a lockfile
       changes what every consumer resolves to); this file cannot know what
       changed inside it, so it cannot narrow.

       Widening happens for THIS file right here — same as the isShared arms
       above — rather than being deferred to a check at the end of the whole
       changeset. Deferring it was the bug: gating it on "patterns is still
       empty" meant an unmapped file's necessary widening silently vanished
       the moment any other file in the same changeset happened to map
       narrowly (a lockfile bump alongside a one-line docs edit, say), even
       though nx had marked the project affected independently of that other
       file. Widening per file, not per changeset, is what keeps the answer
       right regardless of what else is in the diff. */
    if (!inStorybookOrShared && !inDocsOrShared) {
      unmapped.push(change.path);

      if (storybookNarrowable) {
        storybookNarrowable = false;
        for (const id of allStoryIds) {
          patterns.add(idPrefix(id));
        }
        reasons.push(
          `${change.path} cannot be mapped to any story or route, so every storybook shot runs`,
        );
      }

      if (docsNarrowable) {
        docsNarrowable = false;
        for (const route of allRoutes) {
          patterns.add(routePattern(route));
        }
        reasons.push(
          `${change.path} cannot be mapped to any story or route, so every docs shot runs`,
        );
      }
    }
  }

  /* Backstop only: with widening now happening per file above, this should be
     unreachable whenever an affected project's shot set is non-empty. Left in
     place for the degenerate edge case of an affected project with zero shots
     of its own in `shots` (nothing to widen to), so an unmapped change still
     surfaces its reason rather than falling through to the generic message
     below with no explanation. */
  if (patterns.size === 0 && unmapped.length > 0) {
    reasons.push(
      `${unmapped.join(', ')} cannot be mapped to any story or route, so every shot of the affected project(s) runs`,
    );
  }

  if (patterns.size === 0) {
    return {
      run: false,
      grep: null,
      reason: reasons.length > 0 ? reasons.join('; ') : 'nothing in the change maps to a shot',
    };
  }

  return {
    run: true,
    grep: [...patterns].join('|'),
    reason:
      reasons.length > 0 ? reasons.join('; ') : 'scoped to the components and routes that changed',
  };

  function addComponent({ name, patterns: out, allStoryIds: ids, allRoutes: routes, status }) {
    const prefix = storyPrefix(name);
    let storybookMatched = false;
    if (storybookNarrowable && ids.some((id) => id.startsWith(prefix))) {
      out.add(prefix);
      storybookMatched = true;
    }
    /* Independent of the docs side below: either side can be satisfied while
       the other is not, and each must be checked on its own. A single shared
       `matched` flag is how a drifted story title (or docs slug) used to stop
       being tested silently — the side that still matched would mask the
       side that did not. */
    const storybookOk =
      !storybookAffected || !storybookNarrowable || storybookMatched || status === 'D';

    const route = `/components/${docsSlug(name)}`;
    let docsMatched = false;
    if (docsNarrowable && routes.includes(route)) {
      out.add(routePattern(route));
      docsMatched = true;
    }
    const docsOk = !docsAffected || !docsNarrowable || docsMatched || status === 'D';

    /* Loud on purpose. A component renamed without its story or its docs slug
       following would otherwise stop being tested, and the run would be
       green. visual-sweep.test.mjs makes the same argument one layer down: a
       filter that quietly drops a page produces a suite that covers nothing
       and reports nothing. A DELETE is exempt: the subject is gone by
       definition, so its absence from the post-change shot list is expected,
       not drift — the routine "retire a component" PR must not hard-fail. */
    if (!storybookOk || !docsOk) {
      const problems = [];
      if (!storybookOk) {
        problems.push(`no story id '${prefix}*'`);
      }
      if (!docsOk) {
        problems.push(`no route '${route}'`);
      }
      throw new Error(
        `visual-scope: '${name}' matched ${problems.join(' and ')}. ` +
          'Either the component has no coverage, or its story title or docs slug has drifted from its ' +
          'filename. Refusing to silently narrow — fix the mapping or add the coverage.',
      );
    }
  }

  function addStories({ name, patterns: out, allStoryIds: ids, status }) {
    const prefix = findStoryPrefix(name, ids);
    if (!prefix) {
      /* A deleted story file naturally matches no id in the post-change
         enumeration — that is the deletion working as intended, not drift. */
      if (status === 'D') {
        return;
      }
      throw new Error(
        `visual-scope: story file for '${name}' matched no story id in any namespace. ` +
          "The file's title has drifted from its filename.",
      );
    }
    out.add(prefix);
  }

  function addRoute({ segment, patterns: out, allRoutes: routes, source, status }) {
    const route = `/${segment}`;

    /* A Next.js dynamic segment (`[kit]`) never appears in the suite's own
       route enumeration — routes.ts lists concrete paths, not patterns — so
       this can never match `routes` by equality. Select every enumerated
       route under its static prefix instead. An empty match means the whole
       subtree is deliberately excluded from the sweep (e.g. /brand/ui-kits/),
       which is not drift and must not throw. */
    const dynamicSegmentIndex = route.indexOf('[');
    if (dynamicSegmentIndex !== -1) {
      const staticPrefix = route.slice(0, dynamicSegmentIndex);
      const matches = routes.filter((r) => r.startsWith(staticPrefix));
      if (matches.length === 0) {
        reasons.push(
          `${source} is a dynamic route under '${staticPrefix}', which the suite does not enumerate — treated as a deliberate exclusion, not drift`,
        );
        return;
      }
      for (const match of matches) {
        out.add(routePattern(match));
      }
      return;
    }

    if (!routes.includes(route)) {
      /* Symmetric with addStories/addComponent: a deleted page is expected to
         be absent from the post-change route list. */
      if (status === 'D') {
        return;
      }
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
   they consume, and the suite's own configuration. (packages/ai-patterns/src
   /testing/ is covered here too, redundantly with the layer-1 gate above —
   the gate is what makes this line reachable for playwright.config.ts and
   tests/visual/, which are not under packages/.) */
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

/**
 * `--base <sha>` or `--base=<sha>` from an argv array. Null when absent.
 *
 * `argv.indexOf('--base') + 1` is not enough on its own: when `--base` is
 * absent, `indexOf` returns -1, and -1 + 1 is 0 — `argv[0]`, the node binary
 * path, which is truthy and not the literal string '--base', so a naive
 * `!base || base === '--base'` check never fires and the binary path gets
 * used as a git ref.
 */
export function resolveBaseArg(argv) {
  const eqArg = argv.find((arg) => arg.startsWith('--base='));
  if (eqArg) {
    return eqArg.slice('--base='.length);
  }

  const index = argv.indexOf('--base');
  if (index !== -1 && index + 1 < argv.length) {
    return argv[index + 1];
  }

  return null;
}

/* CLI: prints the scope plan as JSON.

   realpathSync rather than a bare string compare: process.argv[1] can reach
   this file through a symlink (or a relative `./name` / bare-name
   invocation), in which case it never string-equals import.meta.filename
   even though it is the same file on disk. Resolving both to their real path
   first is what makes the comparison correct in all of those cases. */
const isEntrypoint = process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename;

if (isEntrypoint) {
  const base = resolveBaseArg(process.argv);
  if (!base) {
    throw new Error('visual-scope: --base <sha> is required');
  }

  const plan = scopeFor({
    changes: changedFiles(base),
    affectedProjects: affectedProjects(base),
    shots: listShots(),
  });

  process.stdout.write(JSON.stringify(plan));
}
