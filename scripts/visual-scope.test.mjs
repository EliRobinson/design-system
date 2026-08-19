// The dangerous direction for this module is quiet: a scope that is too narrow
// produces a green pull request and stale baselines on main, and nothing
// reports it. So the assertions that matter most here are the ones proving it
// widens when it must — above all the sidebar fan-out, which is why PR #88's
// 142 docs pages legitimately changed.

import { describe, expect, it } from 'vitest';

import { parseNameStatus, scopeFor } from './visual-scope.mjs';

const shots = [
  { project: 'storybook-wide', storyId: 'components-button--primary', route: null },
  { project: 'storybook-wide', storyId: 'components-badge--default', route: null },
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
});

describe('pattern anchoring', () => {
  it('anchors a story pattern on the trailing double dash', () => {
    const withTrap = [
      ...shots,
      {
        project: 'storybook-wide',
        storyId: 'components-dropdownmenu--with-button-trigger',
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
    expect(re.test('components-dropdownmenu--with-button-trigger · light')).toBe(false);
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
