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
 * at all throw.
 *
 * The standing invariant behind layer 1, worth checking any new path against:
 * a path Nx cannot map is a path this scoper cannot see. `nx show projects
 * --affected --files=<path>` answers `[]` for anything that belongs to no
 * project — a file outside every project root, or one reached by an edge Nx's
 * import graph does not model (Playwright's own config, a directory read at
 * build time by a generator rather than imported). An `[]` there is
 * indistinguishable, here, from "nothing renders differently", so it exits
 * early with run:false and zero shots. Whenever a new path can change a
 * rendered pixel without Nx having an edge to it, it must be named in one of
 * the forcing lists below; Nx cannot be taught it. */

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

/* A page in one of the three DERIVED sidebar sections — Foundations,
   Patterns, Guidelines. site-map.ts's derivedSection() builds those sections
   by reading each page's own `metadata.title` / `navTitle` / `order` off
   disk, and that sidebar renders on all 142 docs pages. So editing one of
   these files — not adding or deleting it, merely EDITING it — can retitle or
   reorder a sidebar entry that appears in every single docs shot.
   `[^/]+` mirrors derivedSection's own one-level readdir: only a page.mdx
   directly under the section directory is part of the derived list.

   Component pages, `(docs)/components/*`, are deliberately NOT in here and
   must stay narrow. Their sidebar entries come from the generated component
   manifest (`manifest.ts`, itself a SIDEBAR_SOURCE), not from the page file —
   so editing one changes that one page. That distinction is the whole reason
   this rule is "pages in the derived sections" rather than the far simpler
   "all page files": making it all page files would run 142 docs shots for
   every routine component-doc edit, which is most of them. */
const DERIVED_SECTION_PAGE =
  /^apps\/docs\/src\/app\/\(docs\)\/(?:foundations|patterns|guidelines)\/[^/]+\/page\.(?:mdx|tsx)$/;

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

/* The same shape as the suite-config override above, for the same reason and
   with the same evidence: `nx show projects --affected
   --files=design-system-docs/README.md` returns [] — verified against this
   repo — because the directory belongs to no Nx project at all. It is
   nonetheless read at build time by packages/ai-patterns/scripts/
   build-artifacts.mjs to generate brand-manifest.json, which apps/docs/src/
   lib/brand.ts imports and site-map.ts turns into the UI Kits sidebar section
   on every docs page — and it supplies the content of the eight
   /brand/{assets,guidelines,patterns,slides} shots directly. AGENTS.md names
   it the brand source of truth, so it is actively edited.

   Docs only, not storybook: nothing in Storybook renders brand content.
   Unnarrowable within docs — a brand asset can surface on any docs page via
   the sidebar — so it widens that side whole rather than trying to map a file
   to a route. */
const BRAND_SOURCE_PREFIX = 'design-system-docs/';

function isBrandSource(path) {
  return path.startsWith(BRAND_SOURCE_PREFIX);
}

function touchesBrandSource(changes) {
  return changes.some((change) => isBrandSource(change.path));
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
 * The story-id prefix(es) for a `*.stories.tsx` file's base name, searching
 * every namespace present in `allStoryIds` rather than assuming
 * `components-`. Returns an array — zero, one, or (in the cross-namespace
 * collision case) more than one prefix.
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
 * to enumerate first. When no exact match exists, the *longest* prefix match
 * wins — tracked via a running max, not "first encountered" — for the same
 * reason: a shorter sibling's segment being a prefix of the real match must
 * never decide the answer by enumeration order.
 *
 * Two different namespaces can legitimately share a leaf segment (no such
 * pair exists today, but nothing rules it out structurally). Picking only
 * the first exact match would make THAT case order-dependent too, so every
 * exact match is collected and returned — never just the first — which is
 * also the safe direction: selecting one extra namespace's shots costs
 * minutes, silently dropping one costs a stale baseline. Either way — exact
 * or fallback — the result is independent of `allStoryIds`' order.
 */
function findStoryPrefix(name, allStoryIds) {
  const lower = name.toLowerCase();

  const exactIds = [];
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
      exactIds.push(id);
      continue;
    }

    if (lower.startsWith(segment) && segment.length > bestPrefixLength) {
      bestPrefixId = id;
      bestPrefixLength = segment.length;
    }
  }

  if (exactIds.length > 0) {
    return exactIds.map(idPrefix);
  }

  return bestPrefixId ? [idPrefix(bestPrefixId)] : [];
}

/**
 * `affectedBy(paths)` asks nx which of docs/storybook depend on exactly
 * `paths` — narrower than `affectedProjects`, which answers for the whole
 * changeset and so cannot say whether THIS path is why a project was
 * affected or whether some other path in the same diff is. Required, with
 * no silent no-op default: a default returning `[]` would look identical to
 * "nx confirmed neither" and this file has no way to tell the two apart,
 * which is exactly the class of bug this parameter exists to prevent.
 */
export function scopeFor({ changes, affectedProjects, shots, affectedBy }) {
  const affected = new Set(affectedProjects);
  const forcedBySuiteConfig = touchesSuiteConfig(changes);
  const forcedByBrandSource = touchesBrandSource(changes);
  const docsAffected = affected.has(DOCS_PROJECT) || forcedBySuiteConfig || forcedByBrandSource;
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
      (change.status !== 'M' && DOCS_PAGE.test(change.path)) ||
      /* No status test on this one, unlike the two above: a page in a derived
         section carries its own sidebar entry in its metadata, so a plain
         MODIFY of it can retitle or reorder that entry on all 142 docs pages.
         See DERIVED_SECTION_PAGE for why component pages are excluded. */
      DERIVED_SECTION_PAGE.test(change.path),
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
    const inDocsOrShared =
      isIn(change.path, 'apps/docs') || isShared(change.path) || isBrandSource(change.path);

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
       e.g. pnpm-lock.yaml, package.json, nx.json, tsconfig.base.json,
       .changeset/*.md, README.md, docs/**, CHANGELOG.md, .github/**,
       .prettierrc, CLAUDE.md. (design-system-docs/** does NOT land here —
       nx returns [] for it too, but it feeds the brand manifest the docs
       sidebar renders, so isBrandSource above classifies it into the docs
       side before this point.) This set is far bigger
       than "things that touch every consumer" — most of it has NO edge to
       docs or storybook at all, and every package-changing PR carries a
       .changeset/*.md by policy (quality.yml's "Require a changeset"
       step), so assuming otherwise here would run the full suite on nearly
       every real PR. This file has no way to tell, from the aggregate
       `affectedProjects` alone, whether nx marked a project affected
       because of THIS path or because of some other path in the same diff —
       so it must not guess. Only the path is recorded here; whether it
       widens anything is answered once, after the loop, by asking nx about
       these specific paths. */
    if (!inStorybookOrShared && !inDocsOrShared) {
      unmapped.push(change.path);
    }
  }

  /* Resolved once per changeset, not per file, and only for paths this file
     truly could not classify — asking nx `--files=<these paths>` is the only
     way to know whether THEY are why a project is affected, as opposed to
     some other, already-classified path in the same diff. Skipped entirely
     when there's nothing left that could still widen, so a changeset with no
     unmapped paths (the common case) never pays for the extra nx call. */
  if (unmapped.length > 0 && (storybookNarrowable || docsNarrowable)) {
    if (typeof affectedBy !== 'function') {
      throw new Error(
        'visual-scope: affectedBy(paths) is required when the changeset contains files this module ' +
          `cannot map to a story or route (${unmapped.join(', ')}). Refusing to guess whether nx has ` +
          'an edge to them — that guess is exactly what ran the full suite on nearly every PR before.',
      );
    }

    const affectedByResult = affectedBy(unmapped);
    /* An unusable answer here is indistinguishable from "nx confirmed
       neither project is affected" — the exact same silent-narrowing shape
       the missing-default case above guards against, just one call deeper.
       A nullish return, or any non-array (a bare string would iterate as
       characters into the Set below and match no project name), must be
       loud rather than quietly resolving to an empty set. An explicit `[]`
       is different and stays valid — that's nx actively confirming neither
       project depends on these paths, not a caller that forgot to return. */
    if (!Array.isArray(affectedByResult)) {
      throw new Error(
        `visual-scope: affectedBy(${JSON.stringify(unmapped)}) must return an array of affected ` +
          `project names; got ${JSON.stringify(affectedByResult)}. Refusing to treat an unusable ` +
          'answer as "nx confirmed neither" — that indistinguishability is exactly what a missing ' +
          'return statement would produce silently.',
      );
    }

    const unmappedAffected = new Set(affectedByResult);

    if (unmappedAffected.has(STORYBOOK_PROJECT) && storybookNarrowable) {
      storybookNarrowable = false;
      for (const id of allStoryIds) {
        patterns.add(idPrefix(id));
      }
      reasons.push(
        `${unmapped.join(', ')} cannot be mapped to any story or route, and nx confirms storybook depends on them, so every storybook shot runs`,
      );
    }

    if (unmappedAffected.has(DOCS_PROJECT) && docsNarrowable) {
      docsNarrowable = false;
      for (const route of allRoutes) {
        patterns.add(routePattern(route));
      }
      reasons.push(
        `${unmapped.join(', ')} cannot be mapped to any story or route, and nx confirms docs depends on them, so every docs shot runs`,
      );
    }
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
    /* 'A' as well as 'D': the D exemption exists because a deleted subject is
       absent from the post-change enumeration BY DEFINITION, and an ADDED
       component that has no story yet is absent for exactly the same
       definitional reason — the built Storybook enumerates the stories that
       exist, and a component cannot have "drifted" from coverage it never
       had. Nothing is under-selected by this: a component with no stories has
       no storybook shots to lose, and the docs side of an add is already
       fanned out to every route by the sidebar rule above. Without it,
       committing a new component before its story hard-fails the whole
       `scoped` job at this throw — nothing gets minted, and none of those
       fanned-out docs shots run. */
    const storybookOk =
      !storybookAffected ||
      !storybookNarrowable ||
      storybookMatched ||
      status === 'D' ||
      status === 'A';

    const route = `/components/${docsSlug(name)}`;
    let docsMatched = false;
    if (docsNarrowable && routes.includes(route)) {
      out.add(routePattern(route));
      docsMatched = true;
    }
    /* When the shot list contains no `/components/*` route at all, component
       docs pages are not being screenshotted by any enabled project — today
       because `docs-wide` is commented out in playwright.config.ts (see
       docs/agents/visual-regression.md, "Why docs-wide is disabled"). A
       missing route is then the normal state, not drift, and the guard below
       would hard-fail every modified component.

       Scoped to the whole class on purpose, not to a flag: if `docs-wide`
       comes back, `/components/*` routes reappear in the shot list and the
       guard re-arms by itself. And while it is off, one component whose slug
       drifted still cannot hide — there is nothing for it to hide from, since
       no component route is shot. The guard only relaxes when the entire
       class is absent, never for an individual miss. */
    const docsCoversComponents = routes.some((r) => r.startsWith('/components/'));
    const docsOk =
      !docsAffected || !docsNarrowable || !docsCoversComponents || docsMatched || status === 'D';

    /* Loud on purpose. A component renamed without its story or its docs slug
       following would otherwise stop being tested, and the run would be
       green. visual-sweep.test.mjs makes the same argument one layer down: a
       filter that quietly drops a page produces a suite that covers nothing
       and reports nothing. A DELETE is exempt: the subject is gone by
       definition, so its absence from the post-change shot list is expected,
       not drift — the routine "retire a component" PR must not hard-fail. An
       ADD is exempt on the storybook side for the same definitional reason;
       see the storybookOk comment above. A MODIFY is exempt from neither:
       a component present on both sides of the diff that maps to nothing IS
       drift, and this is the guard that catches it. */
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
    const prefixes = findStoryPrefix(name, ids);
    if (prefixes.length === 0) {
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
    for (const prefix of prefixes) {
      out.add(prefix);
    }
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

/* nx's own project name shape: lowercase/uppercase alphanumerics, dots,
   dashes, underscores — nothing that could also be JSON punctuation. Used
   below to tell "bare project names" apart from "JSON that parsed but
   wasn't an array of names," which whitespace-splitting would otherwise
   turn into plausible-looking garbage instead of failing loudly. */
const PROJECT_NAME = /^[A-Za-z0-9_.-]+$/;

/**
 * Parses `nx show projects`' stdout into an array of project names.
 *
 * The format is not stable across environments: on a developer machine it
 * prints a JSON array, but in the CI container the same command prints
 * bare, newline-separated project names instead — that mismatch is what
 * broke the very first real CI run of this workflow (`--json` was being
 * relied on implicitly instead of passed). Both call sites below now pass
 * `--json` explicitly to ask for the array shape, and this parser stays
 * defensive anyway: an empty or unparseable affected list would mean silent
 * under-selection — a green pull request running against stale baselines,
 * with nothing reporting it.
 *
 * Shared by both call sites on purpose. A second, hand-rolled copy of this
 * parsing is exactly the kind of drift this codebase keeps tripping over.
 */
export function parseNxProjectList(stdout) {
  const trimmed = stdout.trim();
  if (trimmed === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // Valid JSON but not an array (e.g. an object) — fall through to the
    // bare-token form below, where the punctuation check will catch it.
  } catch {
    // Not JSON at all — the CI shape. Fall through.
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.some((token) => !PROJECT_NAME.test(token))) {
    throw new Error(
      `visual-scope: could not parse nx project list from output: ${JSON.stringify(stdout)}`,
    );
  }
  return tokens;
}

/** The projects Nx reports as affected between `base` and the working tree. */
export function affectedProjects(base, { cwd = process.cwd() } = {}) {
  const stdout = execFileSync(
    'pnpm',
    ['exec', 'nx', 'show', 'projects', '--affected', `--base=${base}`, '--json'],
    {
      cwd,
      encoding: 'utf8',
    },
  );
  return parseNxProjectList(stdout);
}

/**
 * `scopeFor`'s `affectedBy`: the projects nx reports affected by exactly
 * `paths`, not by the whole diff. Same invocation shape as `affectedProjects`
 * above, `--files=` in place of `--base=`. Only called by `scopeFor` when the
 * changeset has at least one path it could not classify itself — one extra
 * `nx show projects` call, paid only then, never on an ordinary PR that maps
 * cleanly.
 */
export function affectedByPaths(paths, { cwd = process.cwd() } = {}) {
  const stdout = execFileSync(
    'pnpm',
    ['exec', 'nx', 'show', 'projects', '--affected', `--files=${paths.join(',')}`, '--json'],
    {
      cwd,
      encoding: 'utf8',
    },
  );
  return parseNxProjectList(stdout);
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
    affectedBy: (paths) => affectedByPaths(paths, { cwd: process.cwd() }),
  });

  process.stdout.write(JSON.stringify(plan));
}
