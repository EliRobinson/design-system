// The dangerous direction for this module is quiet: a scope that is too narrow
// produces a green pull request and stale baselines on main, and nothing
// reports it. So the assertions that matter most here are the ones proving it
// widens when it must — above all the sidebar fan-out, which is why PR #88's
// 142 docs pages legitimately changed.

import { describe, expect, it } from 'vitest';

import { parseNameStatus, resolveBaseArg, scopeFor } from './visual-scope.mjs';

const shots = [
  { project: 'storybook-wide', storyId: 'components-button--primary', route: null },
  { project: 'storybook-wide', storyId: 'components-badge--default', route: null },
  /* Gives VerdictBadge storybook coverage so the fan-out tests below (which
     add it) satisfy addComponent's per-side guard on the storybook side —
     without this, "component added" would throw for lacking a story, which
     is not what those tests are about. */
  { project: 'storybook-wide', storyId: 'components-verdictbadge--default', route: null },
  { project: 'docs-wide', storyId: null, route: '/components/button' },
  { project: 'docs-wide', storyId: null, route: '/components/badge' },
  { project: 'docs-wide', storyId: null, route: '/patterns/forms' },
];

const BOTH = ['docs', 'storybook', 'react'];

const plan = (changes, affectedProjects = BOTH) => scopeFor({ changes, affectedProjects, shots });

describe('layer 1: nx decides whether anything runs', () => {
  it('skips entirely when neither docs nor storybook is affected', () => {
    const result = plan(
      [{ status: 'M', path: 'packages/eslint-config/src/index.js' }],
      ['eslint-config'],
    );
    expect(result.run).toBe(false);
    expect(result.grep).toBeNull();
    expect(result.reason).toMatch(/neither/i);
  });

  it('skips when only the scripts project is affected', () => {
    const result = plan([{ status: 'M', path: 'scripts/visual-scope.mjs' }], ['scripts']);
    expect(result.run).toBe(false);
  });

  it('forces both projects affected for a change nx cannot see an edge to', () => {
    /* nx show projects --affected --files=playwright.config.ts returns [] —
       verified against this repo. The suite's own config is not imported by
       docs or storybook, so nx's import graph has no edge to it at all. */
    const result = scopeFor({
      changes: [{ status: 'M', path: 'playwright.config.ts' }],
      affectedProjects: [],
      shots,
    });
    expect(result.run).toBe(true);
    expect(result.grep).toContain('components-button--');
    expect(result.grep).toContain('components-badge--');
    expect(result.grep).toContain('/components/button · ');
    expect(result.grep).toContain('/patterns/forms · ');
  });
});

describe('layer 1a: the sidebar fan-out', () => {
  it('runs every docs shot when a component file is ADDED', () => {
    const result = plan([
      { status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' },
    ]);
    expect(result.run).toBe(true);
    expect(result.reason).toMatch(/sidebar/i);
    /* Every docs route present, because the manifest-derived sidebar is on all
       of them. This is the PR #88 regression test. */
    expect(result.grep).toContain('/components/button · ');
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('runs every docs shot when a component file is DELETED', () => {
    const result = plan([{ status: 'D', path: 'packages/react/src/components/atoms/Badge.tsx' }]);
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('does NOT fan out when a component file is merely MODIFIED', () => {
    const result = plan([{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }]);
    expect(result.grep).toContain('/components/button · ');
    expect(result.grep).not.toContain('/patterns/forms · ');
    expect(result.grep).not.toContain('/components/badge · ');
  });

  it('fans out when a docs page is added', () => {
    const result = plan([
      { status: 'A', path: 'apps/docs/src/app/(docs)/foundations/motion/page.mdx' },
    ]);
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('fans out on a change to the site map', () => {
    const result = plan([{ status: 'M', path: 'apps/docs/src/lib/site-map.ts' }]);
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('fans out on a change to the site chrome', () => {
    const result = plan([{ status: 'M', path: 'apps/docs/src/app/(docs)/layout.tsx' }]);
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('fans out the docs side only, leaving storybook narrowed', () => {
    const result = plan([
      { status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' },
    ]);
    /* Positive assertion: storybook narrowed to VerdictBadge's own prefix,
       not merely "doesn't contain badge's". A grep that matched nothing at
       all on the storybook side would also pass the old negative-only
       assertion, which is why it wasn't proof of narrowing. */
    expect(result.grep).toContain('components-verdictbadge--');
    expect(result.grep).not.toContain('components-badge--');
  });
});

describe('layer 2: narrowing', () => {
  it('maps a component file to its stories and its docs page', () => {
    const result = plan([{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }]);
    expect(result.grep).toContain('components-button--');
    expect(result.grep).toContain('/components/button · ');
  });

  it('maps a multi-word component to both of its naming forms', () => {
    const withPicker = [
      ...shots,
      { project: 'storybook-wide', storyId: 'components-datepicker--default', route: null },
      { project: 'docs-wide', storyId: null, route: '/components/date-picker' },
    ];
    const result = scopeFor({
      changes: [{ status: 'M', path: 'packages/react/src/components/molecules/DatePicker.tsx' }],
      affectedProjects: BOTH,
      shots: withPicker,
    });
    expect(result.grep).toContain('components-datepicker--');
    expect(result.grep).toContain('/components/date-picker · ');
  });

  it('maps a story file to its stories', () => {
    const result = plan([{ status: 'M', path: 'apps/storybook/src/stories/Badge.stories.tsx' }]);
    expect(result.grep).toContain('components-badge--');
  });

  it('maps a story file to its ids across a non-components namespace', () => {
    /* apps/storybook/src/stories/MarketingPattern.stories.tsx declares
       title: 'Patterns/Marketing' on this repo today, producing ids like
       patterns-marketing--hero-section — not components-marketingpattern--. */
    const withMarketing = [
      ...shots,
      { project: 'storybook-wide', storyId: 'patterns-marketing--hero-section', route: null },
    ];
    const result = scopeFor({
      changes: [{ status: 'M', path: 'apps/storybook/src/stories/MarketingPattern.stories.tsx' }],
      affectedProjects: BOTH,
      shots: withMarketing,
    });
    expect(result.grep).toContain('patterns-marketing--');
  });

  it('resolves a story file to its EXACT segment match, not a shorter sibling prefix', () => {
    /* components-button--* is a string-prefix of 'buttongroup', so a naive
       "first id whose segment is a prefix of the filename" search can return
       Button's prefix instead of ButtonGroup's, depending on shot-list
       order. No such pair exists in the repo today, but the shape is
       realistic and the bug is silent — a green PR that runs Button's shots
       and none of ButtonGroup's. */
    const withGroup = [
      ...shots,
      { project: 'storybook-wide', storyId: 'components-buttongroup--default', route: null },
    ];
    const result = scopeFor({
      changes: [{ status: 'M', path: 'apps/storybook/src/stories/ButtonGroup.stories.tsx' }],
      affectedProjects: BOTH,
      shots: withGroup,
    });
    expect(result.grep).toContain('components-buttongroup--');
    expect(result.grep).not.toContain('components-button--primary');
  });

  it('gives the identical answer regardless of shot-list enumeration order', () => {
    const buttonFirst = [
      ...shots,
      { project: 'storybook-wide', storyId: 'components-buttongroup--default', route: null },
    ];
    const groupFirst = [
      { project: 'storybook-wide', storyId: 'components-buttongroup--default', route: null },
      ...shots,
    ];
    const changes = [{ status: 'M', path: 'apps/storybook/src/stories/ButtonGroup.stories.tsx' }];

    const a = scopeFor({ changes, affectedProjects: BOTH, shots: buttonFirst });
    const b = scopeFor({ changes, affectedProjects: BOTH, shots: groupFirst });

    expect(a.grep).toContain('components-buttongroup--');
    expect(a.grep).not.toContain('components-button--primary');
    expect(b.grep).toContain('components-buttongroup--');
    expect(b.grep).not.toContain('components-button--primary');
  });

  it('maps a docs page to its own route', () => {
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/patterns/forms/page.mdx' },
    ]);
    expect(result.grep).toBe('/patterns/forms · ');
  });

  it('maps a demo directory to the component page that embeds it', () => {
    const result = plan([
      { status: 'M', path: 'apps/docs/src/components/demos/badge/Variants.tsx' },
    ]);
    expect(result.grep).toBe('/components/badge · ');
  });
});

describe('the unnarrowable fallback is the project, never the world', () => {
  it('runs all storybook shots for a storybook config change, and no docs shots', () => {
    const result = scopeFor({
      changes: [{ status: 'M', path: 'apps/storybook/.storybook/preview.ts' }],
      affectedProjects: ['storybook'],
      shots,
    });
    expect(result.grep).toContain('components-button--');
    expect(result.grep).toContain('components-badge--');
    expect(result.grep).not.toContain('/components/button · ');
  });

  it('runs everything for a token change, because a token change affects everything', () => {
    const result = plan([{ status: 'M', path: 'packages/tokens/src/index.ts' }]);
    expect(result.grep).toContain('components-button--');
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('runs all shots of an affected project for a change under src/lib', () => {
    const result = plan([{ status: 'M', path: 'packages/react/src/lib/cx.ts' }]);
    expect(result.grep).toContain('components-badge--');
  });

  it('runs everything nx marked affected for a change this file cannot classify at all', () => {
    /* nx show projects --affected --files=pnpm-lock.yaml returns docs and
       storybook among its affected projects — verified against this repo.
       pnpm-lock.yaml matches none of COMPONENT_FILE/STORY_FILE/DOCS_PAGE/
       DEMO_FILE, is not under apps/storybook or apps/docs, and is not under
       packages/ — so the *only* correct behaviour is to widen to both
       projects' full sets, never to fall through to run:false while nx says
       otherwise. Same failure mode for package.json, nx.json,
       tsconfig.base.json, types/global.d.ts. */
    const result = plan([{ status: 'M', path: 'pnpm-lock.yaml' }]);
    expect(result.run).toBe(true);
    expect(result.grep).toContain('components-button--');
    expect(result.grep).toContain('components-badge--');
    expect(result.grep).toContain('/components/button · ');
    expect(result.grep).toContain('/components/badge · ');
    expect(result.grep).toContain('/patterns/forms · ');
  });
});

describe('widening for an unmapped file is per file, not per changeset', () => {
  /* Measured against the real shot list: an unmapped file (pnpm-lock.yaml)
     alongside a file that DOES map narrowly used to lose its widening,
     because the old fallback only fired when the whole changeset's patterns
     were still empty. nx said both projects were affected independently of
     what else was in the diff; the second file mapping narrowly must not
     take that back. */
  const fullStoryPrefixes = [
    'components-button--',
    'components-badge--',
    'components-verdictbadge--',
  ];
  const fullRoutePatterns = ['/components/button · ', '/components/badge · ', '/patterns/forms · '];

  function expectFullyWidened(result) {
    expect(result.run).toBe(true);
    for (const prefix of fullStoryPrefixes) {
      expect(result.grep).toContain(prefix);
    }
    for (const pattern of fullRoutePatterns) {
      expect(result.grep).toContain(pattern);
    }
  }

  it('case B: an unmapped file alongside a file under apps/docs still widens storybook fully', () => {
    const result = plan([
      { status: 'M', path: 'pnpm-lock.yaml' },
      { status: 'M', path: 'apps/docs/package.json' },
    ]);
    expectFullyWidened(result);
  });

  it('case C: an unmapped file alongside a narrowly-mapping component still widens both sides fully', () => {
    const result = plan([
      { status: 'M', path: 'pnpm-lock.yaml' },
      { status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' },
    ]);
    expectFullyWidened(result);
  });

  it('case D (sharpest): an unmapped file alongside a single docs page edit still widens both sides fully, not just that one route', () => {
    const result = plan([
      { status: 'M', path: 'pnpm-lock.yaml' },
      { status: 'M', path: 'apps/docs/src/app/(docs)/patterns/forms/page.mdx' },
    ]);
    expectFullyWidened(result);
  });

  it('case D in the opposite order gives the identical fully-widened result', () => {
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/patterns/forms/page.mdx' },
      { status: 'M', path: 'pnpm-lock.yaml' },
    ]);
    expectFullyWidened(result);
  });
});

describe('pattern anchoring', () => {
  it('anchors a story pattern on the trailing double dash', () => {
    /* components-buttongroup--default is the trap: 'components-buttongroup'
       starts with the unanchored prefix 'components-button', so only the
       trailing '--' stops it from being wrongly selected. The previous trap
       (components-dropdownmenu--...) shares no such prefix with
       'components-button' and so passed even without the anchor doing
       anything — it wasn't proof the anchor mattered. */
    const withTrap = [
      ...shots,
      {
        project: 'storybook-wide',
        storyId: 'components-buttongroup--default',
        route: null,
      },
    ];
    const result = scopeFor({
      changes: [{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }],
      affectedProjects: BOTH,
      shots: withTrap,
    });
    const re = new RegExp(result.grep);
    expect(re.test('components-button--primary · light')).toBe(true);
    expect(re.test('components-buttongroup--default · light')).toBe(false);
  });

  it('anchors a route pattern on the trailing separator', () => {
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/components/badge/page.mdx' },
    ]);
    const re = new RegExp(result.grep);
    expect(re.test('/components/badge · light')).toBe(true);
    expect(re.test('/components/badge-group · light')).toBe(false);
  });

  it('never emits a ^ anchor', () => {
    const result = plan([{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }]);
    expect(result.grep).not.toMatch(/\^/);
  });

  it('escapes regex metacharacters in an interpolated route', () => {
    /* Without escaping, the '.' in '/components/x.y' would compile as
       "any character", so a decoy like '/components/xzy' would wrongly
       satisfy the pattern too. */
    const withDot = [...shots, { project: 'docs-wide', storyId: null, route: '/components/x.y' }];
    const result = scopeFor({
      changes: [{ status: 'M', path: 'apps/docs/src/app/(docs)/components/x.y/page.mdx' }],
      affectedProjects: BOTH,
      shots: withDot,
    });
    const re = new RegExp(result.grep);
    expect(re.test('/components/x.y · light')).toBe(true);
    expect(re.test('/components/xzy · light')).toBe(false);
  });
});

describe('the guard fails loudly rather than narrowing quietly', () => {
  it('throws when a component maps to no shot at all', () => {
    expect(() =>
      plan([{ status: 'M', path: 'packages/react/src/components/atoms/Ghost.tsx' }]),
    ).toThrow(/Ghost/);
  });

  it('throws when a docs page maps to no route', () => {
    expect(() =>
      plan([{ status: 'M', path: 'apps/docs/src/app/(docs)/nowhere/page.mdx' }]),
    ).toThrow(/nowhere/);
  });

  it('throws when only the storybook side drifted, even though the docs side matched', () => {
    /* Ordinary drift produces exactly this shape: one side still resolves,
       the other doesn't. A single shared `matched` flag would let the docs
       match paper over the missing story id and run 28 fewer shots with no
       error — Ghost.tsx alone (missing on both sides) can't catch that. */
    const noButtonStory = shots.filter((s) => s.storyId !== 'components-button--primary');
    expect(() =>
      scopeFor({
        changes: [{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }],
        affectedProjects: BOTH,
        shots: noButtonStory,
      }),
    ).toThrow(/Button/);
  });

  it('throws when only the docs side drifted, even though storybook matched', () => {
    const noButtonRoute = shots.filter((s) => s.route !== '/components/button');
    expect(() =>
      scopeFor({
        changes: [{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }],
        affectedProjects: BOTH,
        shots: noButtonRoute,
      }),
    ).toThrow(/Button/);
  });
});

describe('deletions are exempt from the coverage guard', () => {
  it('does not throw when a story file is deleted and its ids are gone', () => {
    const noBadgeStory = shots.filter((s) => s.storyId !== 'components-badge--default');
    expect(() =>
      scopeFor({
        changes: [{ status: 'D', path: 'apps/storybook/src/stories/Badge.stories.tsx' }],
        affectedProjects: BOTH,
        shots: noBadgeStory,
      }),
    ).not.toThrow();
  });

  it('does not throw for the realistic combination: component, story, and docs page deleted together', () => {
    const badgeGone = shots.filter(
      (s) => s.storyId !== 'components-badge--default' && s.route !== '/components/badge',
    );
    expect(() =>
      scopeFor({
        changes: [
          { status: 'D', path: 'packages/react/src/components/atoms/Badge.tsx' },
          { status: 'D', path: 'apps/storybook/src/stories/Badge.stories.tsx' },
          { status: 'D', path: 'apps/docs/src/app/(docs)/components/badge/page.mdx' },
        ],
        affectedProjects: BOTH,
        shots: badgeGone,
      }),
    ).not.toThrow();
  });
});

describe('a Next.js dynamic route segment', () => {
  it('does not throw when its subtree has no enumerated route at all', () => {
    /* apps/docs/src/app/(docs)/brand/ui-kits/[kit]/page.tsx maps to
       /brand/ui-kits/[kit], which tests/visual/docs/routes.ts deliberately
       does not enumerate — verified against this repo. That is exclusion,
       not drift, and must not throw the way a static page with no route
       would. */
    expect(() =>
      plan([{ status: 'M', path: 'apps/docs/src/app/(docs)/brand/ui-kits/[kit]/page.tsx' }]),
    ).not.toThrow();
  });

  it('selects every enumerated route under its static prefix when the subtree is covered', () => {
    const withKits = [
      ...shots,
      { project: 'docs-wide', storyId: null, route: '/brand/ui-kits/acme' },
      { project: 'docs-wide', storyId: null, route: '/brand/ui-kits/globex' },
    ];
    const result = scopeFor({
      changes: [{ status: 'M', path: 'apps/docs/src/app/(docs)/brand/ui-kits/[kit]/page.tsx' }],
      affectedProjects: BOTH,
      shots: withKits,
    });
    expect(result.grep).toContain('/brand/ui-kits/acme · ');
    expect(result.grep).toContain('/brand/ui-kits/globex · ');
    expect(result.grep).not.toContain('/components/button · ');
  });
});

describe('resolveBaseArg', () => {
  it('returns null when --base is absent', () => {
    expect(resolveBaseArg(['node', 'visual-scope.mjs'])).toBeNull();
  });

  it('returns null when --base is the last argv element with no value after it', () => {
    /* The bug this guards: argv.indexOf('--base') + 1 is 0 (the node binary
       path) when --base is absent at all, which a naive `!base` check does
       not catch because argv[0] is truthy. */
    expect(resolveBaseArg(['node', 'visual-scope.mjs', '--base'])).toBeNull();
  });

  it('reads a space-separated --base value', () => {
    expect(resolveBaseArg(['node', 'visual-scope.mjs', '--base', 'abc123'])).toBe('abc123');
  });

  it('reads an --base=value form', () => {
    expect(resolveBaseArg(['node', 'visual-scope.mjs', '--base=abc123'])).toBe('abc123');
  });
});

describe('parseNameStatus', () => {
  it('reads git diff --name-status output', () => {
    const raw =
      'A\tpackages/react/src/components/atoms/VerdictBadge.tsx\nM\tapps/docs/src/lib/site-map.ts\nD\tapps/storybook/src/stories/Old.stories.tsx\n';
    expect(parseNameStatus(raw)).toEqual([
      { status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' },
      { status: 'M', path: 'apps/docs/src/lib/site-map.ts' },
      { status: 'D', path: 'apps/storybook/src/stories/Old.stories.tsx' },
    ]);
  });

  it('reads a rename as a delete plus an add, so the fan-out rule sees it', () => {
    const raw =
      'R100\tpackages/react/src/components/atoms/Old.tsx\tpackages/react/src/components/atoms/New.tsx\n';
    expect(parseNameStatus(raw)).toEqual([
      { status: 'D', path: 'packages/react/src/components/atoms/Old.tsx' },
      { status: 'A', path: 'packages/react/src/components/atoms/New.tsx' },
    ]);
  });

  it('ignores blank lines', () => {
    expect(parseNameStatus('\n\n')).toEqual([]);
  });
});
