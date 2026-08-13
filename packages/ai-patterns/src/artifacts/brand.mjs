/* The brand skill lives in `design-system-docs/` for this repo's own use, and
 * a subset of it ships to consumers. The two audiences need different prose in
 * exactly two places: the file inventory (a consumer receives fewer folders)
 * and the pointer at the component reference (which is `apps/docs` here and a
 * sibling skill folder there).
 *
 * Rather than keep a second hand-written copy that rots — the thing CLAUDE.md
 * forbids — those two passages are wrapped in markers and regenerated at pack
 * time from the file list that actually shipped. A missing marker is a hard
 * error, so the source docs cannot quietly drift out of the transform.
 */

export const BLOCK_BEGIN = '<!-- ds-artifacts:managed:begin -->';
export const BLOCK_END = '<!-- ds-artifacts:managed:end -->';

const GENERATED_NOTE =
  '<!-- Regenerated on every publish from what the tarball actually contains. Do not edit. -->';

/**
 * @param {string} source
 * @param {string} replacement text to put between the markers
 * @param {string} label file name, for the error message
 */
export function replaceManagedBlock(source, replacement, label = 'document') {
  const start = source.indexOf(BLOCK_BEGIN);
  const end = source.indexOf(BLOCK_END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `${label} has no ${BLOCK_BEGIN} … ${BLOCK_END} block. ` +
        'The consumer copy of this file is generated from that block; add it back or ' +
        'update packages/ai-patterns/src/artifacts/brand.mjs.',
    );
  }

  return [
    source.slice(0, start),
    BLOCK_BEGIN,
    '\n',
    GENERATED_NOTE,
    '\n\n',
    replacement.trim(),
    '\n\n',
    source.slice(end),
  ].join('');
}

/** One row per top-level path that survived into the tarball. */
export function renderIndexTable(entries) {
  const width = Math.max(...entries.map((entry) => entry.path.length), 4);
  const pad = (text) => text.padEnd(width);

  return [
    `| ${pad('Path')} | What's there |`,
    `| ${'-'.repeat(width)} | --- |`,
    ...entries.map((entry) => `| ${pad(`\`${entry.path}\``)} | ${entry.description} |`),
  ].join('\n');
}

/**
 * Top-level paths of the shipped subset, with the descriptions the source
 * README uses. Anything added to `BRAND_SOURCES` in the packer needs an entry
 * here or the packer refuses to build.
 */
export const BRAND_INDEX = [
  {
    path: 'colors_and_type.css',
    description:
      'All brand design tokens — colors, type, spacing, radii, shadow, motion. Import this anywhere.',
  },
  { path: 'assets/', description: 'Wordmark, monogram, lockup, dot-grid pattern. SVG-first.' },
  {
    path: 'ui_kits/marketing/',
    description: 'Marketing site kit (homepage, services, store, portfolio).',
  },
  { path: 'ui_kits/webapp/', description: 'Web app / dashboard kit (auth, sidebar, settings).' },
  { path: 'ui_kits/mobile/', description: 'Mobile screen kit.' },
  { path: 'ui_kits/docs/', description: 'Docs / long-form reading kit.' },
  {
    path: 'README.md',
    description: 'Brand voice, color, type, and layout rules. Read this first.',
  },
  { path: 'SKILL.md', description: 'This file — the skill entry point.' },
];

/**
 * The paragraph that tells an agent where the *component* reference is. In this
 * repo that is the docs site; in a consuming repo it is the sibling skill this
 * same command writes, plus the CLI that reads the installed package.
 */
export function referencePointer(referenceSkill) {
  return [
    'The brand rules in this skill cover voice, color, type, and visual direction. They do *not*',
    'describe the React component library — for that, read the sibling skill',
    `\`.claude/skills/${referenceSkill}/\`, which carries a version-stamped snapshot of every`,
    'component and prop table, and run `pnpm ds props <Name>` for the live answer from the',
    'installed package. When the two disagree, the CLI wins.',
  ].join('\n');
}

/**
 * The "making things" paragraph, which is the one piece of skill prose that has
 * to name files — and the three surfaces that carry this skill spell those files
 * differently. In the repo and the consumer tarball the tokens sheet is
 * `colors_and_type.css` and the readme is `README.md`; in the Claude Design
 * project they are `styles.css` and `readme.md`.
 *
 * Parameterised rather than find-and-replaced. The design-project build used to
 * derive its copy by running `.replaceAll('README.md', 'readme.md')` over the
 * whole finished document, which rewrites frontmatter and any future sentence
 * that happens to contain the string, and is silent when it matches nothing.
 * One definition with the names passed in cannot drift and cannot over-reach.
 *
 * @param {{ stylesheet: string, readme: string }} files
 */
export function visualArtifactsGuidance({ stylesheet, readme }) {
  return [
    'If creating visual artifacts (slides, mocks, throwaway prototypes, marketing pages, etc),',
    `copy assets out and create static HTML files for the user to view — always link \`${stylesheet}\``,
    `and use the wordmark from \`assets/\`. If working on production code, copy assets and read the`,
    `rules in ${readme} to become an expert in designing with the Miltinson brand.`,
  ].join('\n');
}

/**
 * @param {object} input
 * @param {string} input.readme source README.md
 * @param {string} input.skill source SKILL.md
 * @param {string} input.referenceSkill directory name of the sibling reference skill
 */
export function transformBrandDocs({ readme, skill, referenceSkill }) {
  return {
    readme: replaceManagedBlock(
      readme,
      renderIndexTable(BRAND_INDEX),
      'design-system-docs/README.md',
    ),
    skill: replaceManagedBlock(
      skill,
      [
        `This skill folder holds: ${BRAND_INDEX.map((entry) => `\`${entry.path}\``).join(', ')}.`,
        'Read `README.md` first, then explore the rest.',
        '',
        referencePointer(referenceSkill),
        '',
        visualArtifactsGuidance({ stylesheet: 'colors_and_type.css', readme: 'README.md' }),
      ].join('\n'),
      'design-system-docs/SKILL.md',
    ),
  };
}
