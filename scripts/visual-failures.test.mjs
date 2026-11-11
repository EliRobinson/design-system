import { describe, expect, it } from 'vitest';

import {
  failedBaselines,
  failedTitles,
  failuresByProject,
  formatPlain,
} from './visual-failures.mjs';

/* What a failed `toHaveScreenshot` leaves in the JSON report. */
const mismatch = (message = '1234 pixels (ratio 0.02 of all image pixels) are different.') => [
  {
    status: 'failed',
    errors: [{ message: `Error: expect(page).toHaveScreenshot(expected) failed\n\n  ${message}` }],
  },
];

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

describe('failedBaselines', () => {
  const mixed = {
    suites: [
      {
        specs: [
          {
            title: 'components-button--primary · light',
            ok: false,
            tests: [
              { projectName: 'storybook-wide', status: 'unexpected', results: mismatch() },
              { projectName: 'storybook-narrow', status: 'expected' },
            ],
          },
          {
            title: '/patterns/forms · dark @responsive',
            ok: false,
            tests: [{ projectName: 'docs-narrow', status: 'unexpected', results: mismatch() }],
          },
          {
            title: '/ · light',
            ok: true,
            tests: [{ projectName: 'docs-wide', status: 'expected' }],
          },
        ],
      },
    ],
  };

  it('names the baseline of each failing test, not of each failing title', () => {
    /* The narrow project passed. Accepting its baseline too would overwrite a
       shot no comparison judged wrong. */
    expect(failedBaselines(mixed)).toEqual({
      paths: [
        'tests/visual/__screenshots__/docs-narrow/docs/docs.spec.ts/patterns-forms-dark.png',
        'tests/visual/__screenshots__/storybook-wide/storybook/storybook.spec.ts/components-button--primary-light.png',
      ],
      unbaselined: [],
    });
  });

  it('reports a failure no baseline can fix', () => {
    const smoke = {
      specs: [
        {
          title: 'refuses to update outside the container',
          ok: false,
          tests: [{ projectName: 'smoke', status: 'unexpected' }],
        },
      ],
    };
    expect(failedBaselines(smoke)).toEqual({
      paths: [],
      unbaselined: ['smoke: refuses to update outside the container'],
    });
  });

  it('leaves checks with no baseline out of the baselined titles', () => {
    const mixed = {
      specs: [
        {
          title: '/components/pagination · reflow',
          ok: false,
          tests: [{ projectName: 'docs-reflow', status: 'unexpected' }],
        },
        {
          title: '/components/card · light',
          ok: false,
          tests: [{ projectName: 'docs-wide', status: 'unexpected', results: mismatch() }],
        },
      ],
    };
    expect(failedTitles(mixed)).toEqual([
      '/components/pagination · reflow',
      '/components/card · light',
    ]);
    expect(failedTitles(mixed, { baselinedOnly: true })).toEqual(['/components/card · light']);
  });

  it('reports a reflow check as a failure no baseline can fix', () => {
    /* Its title is route-shaped. Read as a shot, it would map to a
       `…-reflow.png` baseline that nothing writes, and accept would go green
       with the page still too wide. */
    const reflow = {
      specs: [
        {
          title: '/components/pagination · reflow',
          ok: false,
          tests: [{ projectName: 'docs-reflow', status: 'unexpected' }],
        },
      ],
    };
    expect(failedBaselines(reflow)).toEqual({
      paths: [],
      unbaselined: ['docs-reflow: /components/pagination · reflow'],
    });
  });

  describe('a shot that failed before its comparison (#346)', () => {
    const layout = {
      status: 'failed',
      errors: [
        {
          message:
            'Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBeLessThan\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\nExpected: < 2\nReceived:   14',
        },
      ],
    };
    const report = {
      specs: [
        {
          title: '/preflight/dialog · light',
          ok: false,
          tests: [{ projectName: 'preflight-wide', status: 'unexpected', results: [layout] }],
        },
        {
          title: '/components/card · light',
          ok: false,
          tests: [{ projectName: 'docs-wide', status: 'unexpected', results: mismatch() }],
        },
      ],
    };

    it('leaves it out of the rerun, so the other shots are still recovered', () => {
      expect(failedTitles(report, { baselinedOnly: true })).toEqual(['/components/card · light']);
    });

    it('reports it as a failure no baseline can fix', () => {
      expect(failedBaselines(report)).toEqual({
        paths: [
          'tests/visual/__screenshots__/docs-wide/docs/docs.spec.ts/components-card-light.png',
        ],
        unbaselined: ['preflight-wide: /preflight/dialog · light'],
      });
    });

    it('judges the last attempt, which is the one the rerun repeats', () => {
      const retried = {
        specs: [
          {
            title: '/preflight/dialog · dark',
            ok: false,
            tests: [
              {
                projectName: 'preflight-wide',
                status: 'unexpected',
                results: [...mismatch(), layout],
              },
            ],
          },
        ],
      };
      expect(failedTitles(retried, { baselinedOnly: true })).toEqual([]);
    });

    it('treats a failure with no error recorded as one no baseline can fix', () => {
      const bare = {
        specs: [
          {
            title: '/ · dark',
            ok: false,
            tests: [{ projectName: 'docs-wide', status: 'unexpected' }],
          },
        ],
      };
      expect(failedBaselines(bare).unbaselined).toEqual(['docs-wide: / · dark']);
    });

    it('does not mistake a capture that threw for a mismatch (#320)', () => {
      const threw = {
        specs: [
          {
            title: '/components/dropdown-menu · dark',
            ok: false,
            tests: [
              {
                projectName: 'docs-wide',
                status: 'unexpected',
                results: [
                  {
                    errors: [
                      {
                        message:
                          'Error: page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      expect(failedTitles(threw, { baselinedOnly: true })).toEqual([]);
    });

    it.each([
      ['a pixel difference', mismatch()],
      [
        'a size difference',
        mismatch('Expected an image 1280px by 720px, received 1280px by 744px.'),
      ],
      [
        'a missing baseline',
        mismatch("A snapshot doesn't exist at /work/tests/visual/__screenshots__/a.png."),
      ],
    ])('keeps %s in the rerun', (_name, results) => {
      const one = {
        specs: [
          {
            title: '/ · light',
            ok: false,
            tests: [{ projectName: 'docs-wide', status: 'unexpected', results }],
          },
        ],
      };
      expect(failedTitles(one, { baselinedOnly: true })).toEqual(['/ · light']);
    });

    it('reads a message through the colour codes the reporter keeps', () => {
      const coloured = mismatch(
        '\u001b[31m1234\u001b[39m pixels (ratio 0.02 of all image pixels) are different.',
      );
      const one = {
        specs: [
          {
            title: '/ · light',
            ok: false,
            tests: [{ projectName: 'docs-wide', status: 'unexpected', results: coloured }],
          },
        ],
      };
      expect(failedTitles(one, { baselinedOnly: true })).toEqual(['/ · light']);
    });
  });

  it('ignores a flaky test, which passed on its last attempt', () => {
    const flaky = {
      specs: [
        { title: '/ · dark', ok: true, tests: [{ projectName: 'docs-wide', status: 'flaky' }] },
      ],
    };
    expect(failedBaselines(flaky)).toEqual({ paths: [], unbaselined: [] });
  });
});
