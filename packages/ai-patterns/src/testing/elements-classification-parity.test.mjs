/* One set of touch-target verdicts for the vendored tree, written down twice.
 *
 * `scripts/ai-elements-patches/a11y.mjs` is where a verdict is *applied* — it
 * carries the class string or the `data-touch-target` attribute that makes the
 * classification real in the rendered DOM. `contracts.json` is where a verdict
 * is *published*: a consumer of @elirobinson/ai-elements reads it through
 * `ds contracts` or the MCP server to find out why a copy button in their app
 * measures 32px and does not fail their own contract sweep.
 *
 * They cannot share a definition. One is a build-time script in the repo root
 * and is not published at all; the other is a JSON artifact inside a published
 * package. So the invariant is pinned here, and it is the specific bug this
 * guards: a patch added to the transform layer without a matching entry is a
 * control whose classification exists only as a line of Tailwind nobody can
 * find, and an entry left behind after its patch is deleted is a published
 * claim about geometry that no longer holds.
 *
 * The root scripts/ directory is outside this package, which is why the path is
 * walked up rather than resolved through a package export — there is nothing to
 * export it from, and that is the honest reason this test reads a relative
 * path where its sibling (dense-selector-parity) resolves a specifier.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const contractsPath = fileURLToPath(new URL('../contracts.json', import.meta.url));
const patchesPath = fileURLToPath(
  new URL('../../../../scripts/ai-elements-patches/a11y.mjs', import.meta.url),
);

const contracts = JSON.parse(readFileSync(contractsPath, 'utf8'));
const section = contracts.vendoredElementTargets ?? {};

/* `verifiedBy` is a sibling map keyed by entry name, the same shape every other
   section in this file uses, and `policy` and `react-flow-attribution` are
   prose rather than patches. Everything else must be a patch id. */
const NON_PATCH_KEYS = new Set(['verifiedBy', 'policy', 'react-flow-attribution']);

const classified = Object.keys(section).filter((key) => !NON_PATCH_KEYS.has(key));

describe('vendored Elements touch-target classifications', () => {
  it('publishes every verdict the transform layer applies, and no others', async () => {
    /* Skipped rather than failed when the repo checkout is not present — the
       published package is installed without it, and a consumer running this
       package's suite should not be told their install is broken. */
    if (!existsSync(patchesPath)) {
      console.warn('Skipping: scripts/ai-elements-patches/a11y.mjs is not in this checkout.');
      return;
    }

    const { PATCHES } = await import(patchesPath);
    const applied = PATCHES.map((patch) => patch.id).sort();

    expect(classified.sort()).toEqual(applied);
  });

  it('agrees with the transform layer on which floor each control is held to', async () => {
    if (!existsSync(patchesPath)) return;

    const { PATCHES } = await import(patchesPath);

    for (const patch of PATCHES) {
      /* The entry's first word IS the verdict — that is the format `policy`
         documents, and reading it back is what keeps the format true rather
         than merely described. */
      expect(section[patch.id], `contracts.json has no entry for "${patch.id}"`).toBeTypeOf(
        'string',
      );
      expect(
        section[patch.id].split(' ')[0],
        `"${patch.id}" is ${patch.verdict} in the transform layer`,
      ).toBe(patch.verdict);
    }
  });

  it('says which control each verdict is about, and why it is not the other one', () => {
    for (const key of classified) {
      const entry = section[key];
      /* Not a style check. A verdict with no reason attached is exactly the
         "blanket exemption" this classification exists instead of: the next
         person inherits the decision only if they inherit the argument. */
      expect(entry.length, `"${key}" records a verdict with no reasoning`).toBeGreaterThan(80);
      expect(entry, `"${key}" does not name a control`).toMatch(/ — .+\. Measured /);
    }
  });

  it('holds every classified control to one of the two floors and nothing else', () => {
    for (const key of classified) {
      expect(['primary', 'dense'], `"${key}" invents a third tier`).toContain(
        section[key].split(' ')[0],
      );
    }
  });
});
