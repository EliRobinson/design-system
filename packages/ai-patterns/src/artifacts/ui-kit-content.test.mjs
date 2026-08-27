/* The kits' strings live in one file.
 *
 * The kit taxonomy — marketing, webapp, mobile, docs — is the system's, and it is worth
 * shipping. The strings inside were one company's, spread across 13 files, where a
 * reskin meant 41 edits and a re-crossing of the boundary was invisible. One fixture
 * makes a reskin a one-file job and gives the boundary test a single file to permit.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const kitsDir = join(here, '..', '..', '..', '..', 'design-system-docs', 'ui_kits');
const FIXTURE = '_shared/content.js';

/* The same six terms the task's inventory grep used, plus the three component names it
   found. Deliberately the inventory's list and not a narrower one: `Miltinson` bare
   rather than only `Miltinson Technologies`, because the wordmark and four <title>
   elements carry the short mark and they are no less this company's than the long one. */
const BRAND_TERMS = [
  'Eli Robinson',
  'miltinsons.com',
  'Kids Recipes',
  'Coaching',
  'Miltinson',
  'Maths',
  'CoachingBand',
  'RecipesScreen',
  'MathsScreen',
];

function kitFiles(dir = kitsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return kitFiles(path);
    if (!/\.(jsx|html|md)$/.test(entry.name)) return [];
    return [{ file: relative(kitsDir, path), source: readFileSync(path, 'utf8') }];
  });
}

describe('the kits carry no brand strings outside the content fixture', () => {
  const files = kitFiles().filter(({ file }) => file.replace(/\\/g, '/') !== FIXTURE);

  /* Without this, deleting or renaming the kits would make every assertion below
     vacuously true — the same hole ui-kits-lint.test.mjs guards for its own sweep. */
  it('finds the kit files at all', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)('$file', ({ source }) => {
    expect(BRAND_TERMS.filter((term) => source.includes(term))).toEqual([]);
  });
});
