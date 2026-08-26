// The matrix decides which jobs exist, so the failures worth testing are the
// ones a run cannot report on itself: a project silently dropped out of the
// matrix sweeps nothing and the run still goes green, and a shard with no tests
// in it fails a job for a reason that has nothing to do with a pixel.

import { describe, expect, it } from 'vitest';

import { GROUPS, SHARDS, missingProjects, parseProjects, planMatrix } from './visual-matrix.mjs';

/* Same shape as visual-shots.test.mjs's payload, for the same reason: this is
   what `playwright test --list --reporter=json` emits, nested suites and all. */
const listJson = {
  suites: [
    {
      title: 'config.smoke.spec.ts',
      specs: [
        { title: 'refuses to update outside the container', tests: [{ projectName: 'smoke' }] },
      ],
    },
    {
      title: 'storybook/storybook.spec.ts',
      suites: [
        {
          title: 'nested',
          specs: [
            {
              title: 'components-button--primary · light',
              tests: [{ projectName: 'storybook-wide' }, { projectName: 'storybook-narrow' }],
            },
          ],
        },
      ],
      specs: [
        {
          title: 'components-card--default · dark',
          tests: [{ projectName: 'storybook-wide' }, { projectName: 'storybook-narrow' }],
        },
        { title: '/patterns/forms · light @responsive', tests: [{ projectName: 'docs-narrow' }] },
      ],
    },
  ],
};

describe('parseProjects', () => {
  it('counts the tests each project collected', () => {
    expect(parseProjects(listJson)).toEqual([
      { name: 'docs-narrow', tests: 1 },
      { name: 'smoke', tests: 1 },
      { name: 'storybook-narrow', tests: 2 },
      { name: 'storybook-wide', tests: 2 },
    ]);
  });

  it('recurses into nested suites', () => {
    const wide = parseProjects(listJson).find((project) => project.name === 'storybook-wide');
    expect(wide.tests).toBe(2);
  });
});

describe('planMatrix', () => {
  const projects = [
    { name: 'docs-narrow', tests: 14 },
    { name: 'smoke', tests: 9 },
    { name: 'storybook-narrow', tests: 168 },
    { name: 'storybook-wide', tests: 168 },
  ];

  it('gives every ungrouped project a job of its own', () => {
    const names = planMatrix(projects).map((job) => job.name);
    expect(names).toContain('storybook-wide');
    expect(names).toContain('storybook-narrow');
  });

  it('runs the grouped projects in one job', () => {
    const grouped = planMatrix(projects).find((job) => job.projects.includes('smoke'));
    expect(grouped.projects).toBe('smoke docs-narrow');
    expect(grouped.name).toBe('smoke+docs-narrow');
    expect(planMatrix(projects)).toHaveLength(3);
  });

  it('sweeps every collected project exactly once', () => {
    const swept = planMatrix(projects).flatMap((job) => job.projects.split(' '));
    expect([...swept].sort()).toEqual(projects.map((project) => project.name).sort());
  });

  it('leaves an absent project out of the matrix entirely', () => {
    /* A project commented out in playwright.config.ts never appears in the
       enumeration and must produce no job — a job would fail with "Project(s)
       'docs-wide' not found". This is how `docs-wide` behaved between #101 and
       #105, and how any project switched off in future will. */
    const names = planMatrix(projects).map((job) => job.name);
    expect(names.some((name) => name.startsWith('docs-wide'))).toBe(false);
  });

  it('shards a project that asks for it, and names the shards distinctly', () => {
    const sharded = planMatrix([...projects, { name: 'docs-wide', tests: 142 }]).filter((job) =>
      job.projects.includes('docs-wide'),
    );

    expect(sharded).toHaveLength(SHARDS['docs-wide']);
    expect(sharded.map((job) => job.name)).toEqual(['docs-wide 1/2', 'docs-wide 2/2']);
    /* The slug names an artifact and a blob report file, so two shards sharing
       one would have the second overwrite the first at merge time. */
    expect(new Set(sharded.map((job) => job.slug)).size).toBe(2);
    expect(sharded.map((job) => job.shardIndex)).toEqual([1, 2]);
    expect(sharded.every((job) => job.shardTotal === 2)).toBe(true);
  });

  it('emits one shard per test when a sharded project has fewer tests than shards', () => {
    /* An empty shard is a hard "no tests found" failure in Playwright, and
       nothing about it looks like a baseline problem in the log. */
    const sharded = planMatrix([...projects, { name: 'docs-wide', tests: 1 }]);
    const docsWide = sharded.filter((job) => job.projects.includes('docs-wide'));

    expect(docsWide).toHaveLength(1);
    expect(docsWide[0].shardTotal).toBe(1);
    expect(docsWide[0].name).toBe('docs-wide');
  });

  it('marks an unsharded job as shard 1 of 1', () => {
    const wide = planMatrix(projects).find((job) => job.name === 'storybook-wide');
    expect(wide).toMatchObject({ shardIndex: 1, shardTotal: 1, projects: 'storybook-wide' });
  });

  it('refuses an empty enumeration rather than emitting an empty matrix', () => {
    /* A matrix of [] skips every sweep job, and a skipped job is not a failed
       one — the run would go green having compared nothing. */
    expect(() => planMatrix([])).toThrow(/collected no projects/);
  });

  it('names every project of a grouped job in `projects`', () => {
    /* missingProjects splits this field to learn what a job was expected to
       sweep, so a grouped job that named only its first project would let the
       second vanish from a run unnoticed. */
    const grouped = planMatrix(projects).find((job) => job.name === 'smoke+docs-narrow');
    expect(grouped.projects.split(' ')).toEqual(['smoke', 'docs-narrow']);
  });

  it('keeps the group definitions disjoint', () => {
    const seen = new Set();
    for (const group of GROUPS) {
      for (const name of group) {
        expect(seen.has(name)).toBe(false);
        seen.add(name);
      }
    }
  });
});

describe('missingProjects', () => {
  const matrix = [
    { name: 'smoke+docs-narrow', projects: 'smoke docs-narrow' },
    { name: 'docs-wide 1/2', projects: 'docs-wide' },
    { name: 'docs-wide 2/2', projects: 'docs-wide' },
    { name: 'storybook-wide', projects: 'storybook-wide' },
  ];

  it('is empty when every project the matrix named reported', () => {
    const reported = [
      { name: 'docs-narrow', tests: 14 },
      { name: 'docs-wide', tests: 142 },
      { name: 'smoke', tests: 9 },
      { name: 'storybook-wide', tests: 168 },
    ];
    expect(missingProjects(matrix, reported)).toEqual([]);
  });

  it('names a project whose shards never made it into the merged report', () => {
    /* The failure this exists for: a blob report that failed to upload leaves
       every other leg green and the merged report short, so the run looks
       clean while a whole project was never compared. */
    const reported = [
      { name: 'docs-narrow', tests: 14 },
      { name: 'smoke', tests: 9 },
      { name: 'storybook-wide', tests: 168 },
    ];
    expect(missingProjects(matrix, reported)).toEqual(['docs-wide']);
  });

  it('sees a project lost from inside a grouped job', () => {
    const reported = [
      { name: 'docs-wide', tests: 142 },
      { name: 'smoke', tests: 9 },
      { name: 'storybook-wide', tests: 168 },
    ];
    expect(missingProjects(matrix, reported)).toEqual(['docs-narrow']);
  });

  it('reports every expected project when nothing reported at all', () => {
    expect(missingProjects(matrix, [])).toEqual([
      'docs-narrow',
      'docs-wide',
      'smoke',
      'storybook-wide',
    ]);
  });

  it('ignores a project that reported without being in the matrix', () => {
    /* Not this check's business: an extra project is a config change, and the
       enumeration the matrix was planned from would already have carried it. */
    const reported = [
      { name: 'docs-narrow', tests: 14 },
      { name: 'docs-wide', tests: 142 },
      { name: 'smoke', tests: 9 },
      { name: 'storybook-narrow', tests: 168 },
      { name: 'storybook-wide', tests: 168 },
    ];
    expect(missingProjects(matrix, reported)).toEqual([]);
  });
});
