/* The `design-system-reference` skill, from its inputs.
 *
 * One builder, two callers. `scripts/build-artifacts.mjs` runs it at pack time
 * against this workspace, so the tarball carries a snapshot. `ds-resync
 * artifacts` runs it again in the consuming repo against the react and tokens
 * that repo has INSTALLED, so what it writes describes the code that is there
 * rather than the code that was current when ai-patterns was packed (#257).
 *
 * Everything that is not react or tokens belongs to ai-patterns itself. The
 * brand voice is read from the brand skill's README, which ships anyway; the
 * pack id, note and artifact list are staged in `reference-inputs.json`. Both
 * callers read the same values, so the same inputs give the same bytes.
 */

import { llmsFull, llmsIndex } from './llms.mjs';
import { referenceSkillDoc, SKILL_DIRS } from './skills.mjs';

/** Marks a staged file the reference builder produces, in `artifacts.json`. */
export const REFERENCE_GENERATOR = 'reference';

/** The staged inputs file, next to `artifacts.json`. */
export const REFERENCE_INPUTS = 'reference-inputs.json';

/* Where a reader of the packed llms.txt goes next. The docs site answers the
   same question with URLs; a consumer has files and a CLI, so this is one of
   the few things the two corpora cannot share. */
const SNAPSHOT_CONTENTS = {
  heading: 'The rest of this snapshot',
  entries: [
    '- `llms-full.txt` — every token, every constraint, and every component with its prop table',
    '- `pnpm ds` / `pnpm ds props <Name>` — the same information read live from the installed',
    '  package. Always authoritative; this file is a convenience for reading in bulk.',
  ],
};

/**
 * @param {object} input
 * @param {{components: object[], hooks: object[]}} input.manifest `@elirobinson/react/manifest`
 * @param {object} input.contracts `src/contracts.json`
 * @param {Array<{name: string, value: string}>} input.tokens parsed token stylesheets
 * @param {{aiPatterns: string, react: string, tokens: string}} input.versions
 * @param {object} input.brand the `brand` block llmsFull takes
 * @returns {Record<string, string>} skills-relative path → contents
 */
export function buildReferenceSkill({ manifest, contracts, tokens, versions, brand }) {
  if (!manifest?.components?.length) {
    throw new Error('@elirobinson/react/manifest describes no components.');
  }
  if (!tokens?.length) {
    throw new Error('No tokens parsed from the @elirobinson/tokens stylesheets.');
  }

  return {
    [`${SKILL_DIRS.reference}/llms.txt`]: llmsIndex({
      manifest,
      versions,
      alsoAvailable: SNAPSHOT_CONTENTS,
    }),
    [`${SKILL_DIRS.reference}/llms-full.txt`]: llmsFull({
      manifest,
      contracts,
      tokens,
      versions,
      brand,
    }),
    [`${SKILL_DIRS.reference}/SKILL.md`]: referenceSkillDoc({
      versions,
      componentCount: manifest.components.length,
      hookCount: manifest.hooks.length,
    }),
  };
}
