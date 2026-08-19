import { describe, expect, it } from 'vitest';

import { failedTitles, failuresByProject, formatPlain } from './visual-failures.mjs';

const report = {
  suites: [
    {
      specs: [
        { title: 'components-button--primary · light', ok: true, tests: [{ status: 'expected' }] },
        { title: 'components-badge--default · dark', ok: false, tests: [{ status: 'unexpected' }] },
        {
          title: '/patterns/forms · light @responsive',
          ok: false,
          tests: [{ status: 'unexpected' }],
        },
      ],
      suites: [
        {
          specs: [{ title: '/ · dark', ok: false, tests: [{ status: 'unexpected' }] }],
        },
      ],
    },
  ],
};

describe('failedTitles', () => {
  it('returns only the failing specs', () => {
    expect(failedTitles(report).sort()).toEqual([
      '/ · dark',
      '/patterns/forms · light @responsive',
      'components-badge--default · dark',
    ]);
  });

  it('recurses into nested suites', () => {
    expect(failedTitles(report)).toContain('/ · dark');
  });

  it('de-duplicates a title that failed in more than one project', () => {
    const twice = {
      suites: [
        {
          specs: [
            { title: 'a · light', ok: false, tests: [{ status: 'unexpected' }] },
            { title: 'a · light', ok: false, tests: [{ status: 'unexpected' }] },
          ],
        },
      ],
    };
    expect(failedTitles(twice)).toEqual(['a · light']);
  });

  it('is empty for a clean report', () => {
    expect(failedTitles({ suites: [] })).toEqual([]);
  });
});

describe('failuresByProject', () => {
  const byProject = {
    suites: [
      {
        specs: [
          {
            title: 'components-button--primary · light',
            ok: true,
            tests: [{ projectName: 'storybook-wide' }, { projectName: 'storybook-narrow' }],
          },
          {
            title: 'components-badge--default · dark',
            ok: false,
            tests: [{ projectName: 'storybook-wide' }, { projectName: 'storybook-narrow' }],
          },
        ],
        suites: [
          {
            specs: [
              { title: '/ · dark', ok: false, tests: [{ projectName: 'docs-wide' }] },
              { title: '/tokens · dark', ok: false, tests: [{ projectName: 'docs-wide' }] },
              { title: '/brand · light', ok: false, tests: [{ projectName: 'docs-wide' }] },
            ],
          },
        ],
      },
    ],
  };

  it('counts failing shots per project, most first', () => {
    expect(failuresByProject(byProject)).toEqual([
      { project: 'docs-wide', shots: 3 },
      { project: 'storybook-narrow', shots: 1 },
      { project: 'storybook-wide', shots: 1 },
    ]);
  });

  it('counts a title that failed in two projects once in each', () => {
    /* The opposite of failedTitles' de-duplication, and deliberately so: one
       title is one shot to regenerate but two red baselines on disk, and this
       summary is about the second number. */
    const titles = failedTitles(byProject);
    const shots = failuresByProject(byProject).reduce((sum, row) => sum + row.shots, 0);
    expect(titles).toHaveLength(4);
    expect(shots).toBe(5);
  });

  it('recurses into nested suites', () => {
    expect(failuresByProject(byProject).map((row) => row.project)).toContain('docs-wide');
  });

  it('is empty for a clean report, so a red run with no failing shot reads as one', () => {
    expect(failuresByProject({ suites: [] })).toEqual([]);
  });
});

describe('formatPlain', () => {
  it('is null for an empty list, so a caller cannot print a blank line', () => {
    expect(formatPlain([])).toBeNull();
  });

  it('prints titles unescaped, one per line — no grepFor involved', () => {
    // A title containing every character escapeRegExp would touch: | . ( [
    const titles = [
      'components-badge--default · dark',
      'Button | Primary',
      'components-input--a.b · light',
      'Card (elevated)',
      'Input [required] · light',
    ];

    expect(formatPlain(titles)).toBe(
      [
        'components-badge--default · dark',
        'Button | Primary',
        'components-input--a.b · light',
        'Card (elevated)',
        'Input [required] · light',
      ].join('\n'),
    );
  });
});
