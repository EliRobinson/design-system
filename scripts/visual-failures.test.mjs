import { describe, expect, it } from 'vitest';

import { failedTitles, formatPlain } from './visual-failures.mjs';

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
