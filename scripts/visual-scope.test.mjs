// The dangerous direction for this module is quiet: a scope that is too narrow
// produces a green pull request and stale baselines on main, and nothing
// reports it. So the assertions that matter most here are the ones proving it
// widens when it must — above all the sidebar fan-out, which is why PR #88's
// 142 docs pages legitimately changed.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { parseNameStatus, resolveBaseArg, scopeFor } from './visual-scope.mjs';
import { listShots } from './visual-shots.mjs';

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

/* Every test below that reaches an unmapped path (pnpm-lock.yaml and
   friends) needs SOME affectedBy stub, since scopeFor now refuses to guess.
   Defaulting `plan()`'s stub to "nx confirms both" keeps every pre-existing
   test's expectations (full widening) intact without threading a stub
   through each call; tests that need a specific, asserted-on affectedBy
   behaviour (the N3 tests below) call scopeFor directly with their own
   vi.fn(). */
const affectsBoth = () => ['docs', 'storybook'];

const plan = (changes, affectedProjects = BOTH, affectedBy = affectsBoth) =>
  scopeFor({ changes, affectedProjects, shots, affectedBy });

/* Shared by both the round-2 per-file-widening tests and the round-3
   affectedBy tests below — "every story prefix and every route in the base
   fixture is present." */
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

  it('runs every docs shot for a brand-source change nx reports no project for', () => {
    /* `nx show projects --affected --files=design-system-docs/README.md`
       returns [] — verified against this repo — because that directory
       belongs to no Nx project. It is nonetheless read at build time to
       generate brand-manifest.json, which the docs site imports and
       site-map.ts renders into the UI Kits sidebar section on every docs
       page, plus the eight /brand/* shots directly. Without the override,
       run:false: zero shots for a change to the brand source of truth.

       No affectedBy stub on purpose: this path must be CLASSIFIED into the
       docs side rather than left unmapped, so nothing here should need to
       ask nx a second question. Passing no stub makes that assertion — a
       regression that leaves it unmapped throws instead of passing quietly. */
    const result = scopeFor({
      changes: [{ status: 'M', path: 'design-system-docs/README.md' }],
      affectedProjects: [],
      shots,
    });
    expect(result.run).toBe(true);
    for (const pattern of fullRoutePatterns) {
      expect(result.grep).toContain(pattern);
    }
  });

  it('leaves storybook alone for a brand-source change — nothing in storybook renders brand content', () => {
    const result = scopeFor({
      changes: [{ status: 'M', path: 'design-system-docs/ui-kits/acme/brand.json' }],
      affectedProjects: [],
      shots,
    });
    for (const prefix of fullStoryPrefixes) {
      expect(result.grep).not.toContain(prefix);
    }
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

  it('fans out when a page in a DERIVED sidebar section is merely MODIFIED', () => {
    /* Measured by the reviewer against the real shot list: this used to
       select 2 shots when up to 142 could have changed. site-map.ts's
       derivedSection() reads each Foundations/Patterns/Guidelines page's own
       metadata (title, navTitle, order) off disk to build that sidebar
       section, and the sidebar renders on every docs page — so editing the
       metadata in one page retitles or reorders an entry on all of them. */
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/foundations/color/page.mdx' },
    ]);
    expect(result.run).toBe(true);
    for (const pattern of fullRoutePatterns) {
      expect(result.grep).toContain(pattern);
    }
  });

  it('fans out for a MODIFIED page in each of the three derived sections', () => {
    for (const section of ['foundations', 'patterns', 'guidelines']) {
      const result = plan([
        { status: 'M', path: `apps/docs/src/app/(docs)/${section}/anything/page.mdx` },
      ]);
      for (const pattern of fullRoutePatterns) {
        expect(result.grep).toContain(pattern);
      }
    }
  });

  it('does NOT fan out for a MODIFIED component docs page — its sidebar entry comes from the manifest', () => {
    /* The distinction that keeps this rule from being "all page files":
       (docs)/components/* pages take their sidebar entry from the generated
       component manifest, not from the page file, so editing one changes
       that one page. Fanning out here would run 142 docs shots for the most
       routine docs edit there is. */
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/components/badge/page.mdx' },
    ]);
    expect(result.grep).toBe('/components/badge · ');
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

  it('prefers the longest prefix match when there is no exact match, regardless of enumeration order', () => {
    /* Mutation testing showed reverting "longest wins" to "first encountered"
       killed no test — this pins it. 'buttongroupextra' has no exact id, but
       is a prefix-match candidate for BOTH 'button' (len 6) and 'buttongroup'
       (len 11); the longer one must win, in either order. */
    const idsButtonFirst = [
      { project: 'storybook-wide', storyId: 'components-button--primary', route: null },
      { project: 'storybook-wide', storyId: 'components-buttongroup--default', route: null },
    ];
    const idsGroupFirst = [
      { project: 'storybook-wide', storyId: 'components-buttongroup--default', route: null },
      { project: 'storybook-wide', storyId: 'components-button--primary', route: null },
    ];
    const changes = [
      { status: 'M', path: 'apps/storybook/src/stories/ButtonGroupExtra.stories.tsx' },
    ];

    const a = scopeFor({ changes, affectedProjects: BOTH, shots: idsButtonFirst });
    const b = scopeFor({ changes, affectedProjects: BOTH, shots: idsGroupFirst });

    expect(a.grep).toBe('components-buttongroup--');
    expect(b.grep).toBe('components-buttongroup--');
  });

  it('returns every exact match across namespaces, not just the first, regardless of enumeration order', () => {
    /* Latent: no two namespaces share a leaf segment in this repo today, but
       nothing rules it out structurally, and picking only the first exact
       match would make that case order-dependent — the same class of bug as
       the prefix case, just at the exact-match tier. The safe resolution is
       to select every exact match rather than pick one. */
    const idsComponentsFirst = [
      { project: 'storybook-wide', storyId: 'components-button--primary', route: null },
      { project: 'storybook-wide', storyId: 'patterns-button--hero', route: null },
    ];
    const idsPatternsFirst = [
      { project: 'storybook-wide', storyId: 'patterns-button--hero', route: null },
      { project: 'storybook-wide', storyId: 'components-button--primary', route: null },
    ];
    const changes = [{ status: 'M', path: 'apps/storybook/src/stories/Button.stories.tsx' }];

    const a = scopeFor({ changes, affectedProjects: BOTH, shots: idsComponentsFirst });
    const b = scopeFor({ changes, affectedProjects: BOTH, shots: idsPatternsFirst });

    for (const result of [a, b]) {
      expect(result.grep).toContain('components-button--');
      expect(result.grep).toContain('patterns-button--');
    }
  });

  it('maps a docs page to its own route', () => {
    /* A component page, not a Foundations/Patterns/Guidelines one: those
       three sections derive their sidebar entries from the page files
       themselves and so fan out on any edit — see the fan-out block above. */
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/components/badge/page.mdx' },
    ]);
    expect(result.grep).toBe('/components/badge · ');
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

  it('runs everything nx marked affected for a change this file cannot classify at all, when affectedBy confirms it (case A)', () => {
    /* nx show projects --affected --files=pnpm-lock.yaml returns docs and
       storybook among its affected projects — verified against this repo.
       pnpm-lock.yaml matches none of COMPONENT_FILE/STORY_FILE/DOCS_PAGE/
       DEMO_FILE, is not under apps/storybook or apps/docs, and is not under
       packages/ — so the *only* correct behaviour, once affectedBy confirms
       nx has an edge to it specifically, is to widen to both projects' full
       sets. Same failure mode for package.json, nx.json, tsconfig.base.json,
       types/global.d.ts. */
    const affectedByStub = vi.fn(() => ['docs', 'storybook']);
    const result = scopeFor({
      changes: [{ status: 'M', path: 'pnpm-lock.yaml' }],
      affectedProjects: BOTH,
      shots,
      affectedBy: affectedByStub,
    });
    expectFullyWidened(result);
    expect(affectedByStub).toHaveBeenCalledTimes(1);
    expect(affectedByStub).toHaveBeenCalledWith(['pnpm-lock.yaml']);
  });
});

describe('widening for an unmapped file is per file, not per changeset', () => {
  /* Measured against the real shot list: an unmapped file (pnpm-lock.yaml)
     alongside a file that DOES map narrowly used to lose its widening,
     because the old fallback only fired when the whole changeset's patterns
     were still empty. nx said both projects were affected independently of
     what else was in the diff; the second file mapping narrowly must not
     take that back. All these use the default affectsBoth stub via plan(),
     since they're about per-file vs. per-changeset widening, not about what
     affectedBy itself reports — that's covered in the affectedBy describe
     block below. */
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
    /* A component page deliberately: one that still maps NARROWLY on its
       own, which is what keeps this a test of per-file widening rather than
       of the derived-section fan-out. */
    const result = plan([
      { status: 'M', path: 'pnpm-lock.yaml' },
      { status: 'M', path: 'apps/docs/src/app/(docs)/components/badge/page.mdx' },
    ]);
    expectFullyWidened(result);
  });

  it('case D in the opposite order gives the identical fully-widened result', () => {
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/components/badge/page.mdx' },
      { status: 'M', path: 'pnpm-lock.yaml' },
    ]);
    expectFullyWidened(result);
  });
});

describe('affectedBy governs whether an unmapped file actually widens anything', () => {
  /* The N3 regression: a blanket "nx marked some project affected, widen for
     every unmapped file" rule fires on nearly every real PR, because
     .changeset/*.md, README.md, docs/**, and friends are unmapped but have
     NO edge to docs or storybook — and every package-changing PR carries a
     .changeset/*.md by policy. affectedBy asks nx about the unmapped paths
     specifically, and only what it confirms gets widened. */

  it('does not call affectedBy at all when every path in the changeset maps', () => {
    const affectedByStub = vi.fn(() => ['docs', 'storybook']);
    scopeFor({
      changes: [{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }],
      affectedProjects: BOTH,
      shots,
      affectedBy: affectedByStub,
    });
    expect(affectedByStub).not.toHaveBeenCalled();
  });

  it('stays narrow when affectedBy says the unmapped file affects neither project (the .changeset regression)', () => {
    /* Exactly the measured regression: a component edit narrows fine on its
       own, but a .changeset/*.md file — required by policy on every
       package-changing PR — used to force a full 492-shot run alongside it.
       nx has no edge from docs or storybook to a changeset file, so
       affectedBy reports []. */
    const affectedByStub = vi.fn(() => []);
    const result = scopeFor({
      changes: [
        { status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' },
        { status: 'A', path: '.changeset/x.md' },
      ],
      affectedProjects: BOTH,
      shots,
      affectedBy: affectedByStub,
    });
    expect(result.grep).toBe('components-button--|/components/button · ');
    expect(affectedByStub).toHaveBeenCalledTimes(1);
    expect(affectedByStub).toHaveBeenCalledWith(['.changeset/x.md']);
  });

  it('widens both sides fully when affectedBy confirms both, even though another file already mapped narrowly (case C, re-asserted)', () => {
    const affectedByStub = vi.fn(() => ['docs', 'storybook', 'react']);
    const result = scopeFor({
      changes: [
        { status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' },
        { status: 'M', path: 'pnpm-lock.yaml' },
      ],
      affectedProjects: BOTH,
      shots,
      affectedBy: affectedByStub,
    });
    expectFullyWidened(result);
    expect(affectedByStub).toHaveBeenCalledTimes(1);
    expect(affectedByStub).toHaveBeenCalledWith(['pnpm-lock.yaml']);
  });

  it('widens only the side affectedBy actually reports', () => {
    const affectedByStub = vi.fn(() => ['docs']);
    const result = scopeFor({
      changes: [{ status: 'M', path: 'pnpm-lock.yaml' }],
      affectedProjects: BOTH,
      shots,
      affectedBy: affectedByStub,
    });
    expect(result.run).toBe(true);
    for (const pattern of fullRoutePatterns) {
      expect(result.grep).toContain(pattern);
    }
    for (const prefix of fullStoryPrefixes) {
      expect(result.grep).not.toContain(prefix);
    }
  });

  it('throws rather than guessing when affectedBy is required but missing', () => {
    expect(() =>
      scopeFor({
        changes: [{ status: 'M', path: 'pnpm-lock.yaml' }],
        affectedProjects: BOTH,
        shots,
      }),
    ).toThrow(/affectedBy/);
  });

  describe('affectedBy must return a real array — a nullish or non-array answer is indistinguishable from "nx confirmed neither"', () => {
    /* Today's only implementation (affectedByPaths) can't produce this —
       JSON.parse either returns an array or throws — but this is the fourth
       appearance of the same silent-narrowing shape in this module, and the
       likeliest future mistake is a wrapper affectedBy that forgets
       `return`. An unusable answer must be loud, exactly like the missing
       affectedBy case just above. */
    it.each([
      ['undefined', () => undefined],
      ['null', () => null],
      ["the bare string 'docs'", () => 'docs'],
    ])('throws when affectedBy returns %s', (_label, badStub) => {
      expect(() =>
        scopeFor({
          changes: [{ status: 'M', path: 'pnpm-lock.yaml' }],
          affectedProjects: BOTH,
          shots,
          affectedBy: badStub,
        }),
      ).toThrow(/affectedBy/);
    });

    it('names the offending value in the error', () => {
      expect(() =>
        scopeFor({
          changes: [{ status: 'M', path: 'pnpm-lock.yaml' }],
          affectedProjects: BOTH,
          shots,
          affectedBy: () => 'docs',
        }),
      ).toThrow(/"docs"/);
    });

    it('does NOT throw when affectedBy returns an empty array — that is nx actively confirming neither project is affected', () => {
      /* The whole point of the distinction: [] is a real, valid answer (the
         .changeset/x.md case elsewhere in this file), not a caller mistake. */
      const result = scopeFor({
        changes: [{ status: 'M', path: 'pnpm-lock.yaml' }],
        affectedProjects: BOTH,
        shots,
        affectedBy: () => [],
      });
      expect(result.run).toBe(false);
    });
  });

  it('does not call affectedBy at all when nothing could still widen, even with an unmapped path present (F2)', () => {
    /* By the time pnpm-lock.yaml is reached, the docs side is already fully
       widened by the VerdictBadge fan-out and the storybook side is already
       fully widened by the unnarrowable .storybook/preview.ts config change
       — so there is nothing left an nx call could change. Calling
       affectedBy anyway would cost an extra nx round-trip for no scope
       difference, and would spuriously throw when affectedBy happens to be
       absent even though nothing needed it. The stub here throws if called
       at all, so this pins that the guard actually skips the call rather
       than merely happening not to change the result. */
    const affectedByStub = vi.fn(() => {
      throw new Error('affectedBy should not have been called: nothing could still widen');
    });
    const result = scopeFor({
      changes: [
        { status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' },
        { status: 'M', path: 'apps/storybook/.storybook/preview.ts' },
        { status: 'M', path: 'pnpm-lock.yaml' },
      ],
      affectedProjects: BOTH,
      shots,
      affectedBy: affectedByStub,
    });
    expect(result.run).toBe(true);
    expect(affectedByStub).not.toHaveBeenCalled();
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

describe('an ADDED component with no story yet is exempt on the storybook side', () => {
  /* Verified against the real workflow: adding a component before its story
     threw `visual-scope: 'VisuallyHidden' matched no story id
     'components-visuallyhidden--*'`, which killed the scope step — so nothing
     was minted and none of the fanned-out docs shots ran either. An added
     subject with no story is absent from the post-change enumeration for the
     same definitional reason a deleted one is, and it cannot have drifted
     from coverage it never had. */
  it('does not throw, and still fans the docs side out to every route', () => {
    const noStory = shots.filter((s) => s.storyId !== 'components-verdictbadge--default');
    const result = scopeFor({
      changes: [{ status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' }],
      affectedProjects: BOTH,
      shots: noStory,
      affectedBy: affectsBoth,
    });
    expect(result.run).toBe(true);
    for (const pattern of fullRoutePatterns) {
      expect(result.grep).toContain(pattern);
    }
  });

  it('still throws for a MODIFIED component with no matching story id — that is real drift', () => {
    /* The exemption must not become "never check adds or modifies". A
       component that exists on both sides of the diff and maps to no story
       is drift, and the guard is the only thing that reports it. */
    const noButtonStory = shots.filter((s) => s.storyId !== 'components-button--primary');
    expect(() =>
      scopeFor({
        changes: [{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }],
        affectedProjects: BOTH,
        shots: noButtonStory,
      }),
    ).toThrow(/Button/);
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

/* Everything above asserts against a fixture shot list, which proves the
   scoper is self-consistent — not that the pattern it emits actually selects
   the right tests when Playwright is the one applying it. This does. Same
   guard as visual-shots.test.mjs's disk cross-check: it needs both builds,
   because the specs enumerate stories from Storybook's index.json and routes
   from Next's prerender manifest.

   Worth an out-of-process Playwright call because the anchoring the whole
   narrowing rests on — the ' · ' route separator, the '--' story-id
   separator, the absence of a '^' — is Playwright's --grep semantics, not
   ours, and a version bump could change them silently. Renovate bumps
   Playwright in this repo. */
const BUILDS_PRESENT =
  existsSync('../apps/storybook/storybook-static/index.json') &&
  existsSync('../apps/docs/.next/prerender-manifest.json');

describe.skipIf(!BUILDS_PRESENT)('the emitted pattern, applied by Playwright itself', () => {
  it('selects exactly the 30 tests a modified Button.tsx could have changed', () => {
    const plan = scopeFor({
      changes: [{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }],
      affectedProjects: ['docs', 'storybook', 'react'],
      shots: listShots({ cwd: '..' }),
    });

    /* --list, not a run: Playwright collects and prints the titles without
         rendering a pixel, so this costs well under a second. */
    const listed = execFileSync(
      'pnpm',
      ['exec', 'playwright', 'test', '--list', '--grep', plan.grep],
      { cwd: '..', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );

    const total = listed.match(/Total:\s+(\d+)\s+tests?/);
    /* A missing Total line would otherwise read as "0 tests" — the silent
         under-selection answer this module exists to refuse. */
    expect(total, `no "Total: N tests" line in --list output:\n${listed}`).not.toBeNull();
    expect(Number(total[1])).toBe(30);
  }, 120_000);
});
