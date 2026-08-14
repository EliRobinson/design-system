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
 * @param {string} note provenance comment written just inside the block
 */
export function replaceManagedBlock(
  source,
  replacement,
  label = 'document',
  note = GENERATED_NOTE,
) {
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
    note,
    '\n\n',
    replacement.trim(),
    '\n\n',
    source.slice(end),
  ].join('');
}

/** One row per index path — see `indexPathFor` — that survived into the tarball. */
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
 * The index row a shipped file belongs to: the folder that holds it, or the
 * file itself when it sits at the top of the skill. `ui_kits/` reads as five
 * folders, not one — four kits plus `_shared/` — which is precisely the
 * distinction a first-path-segment comparison cannot make.
 *
 * @param {string} path forward-slash path relative to the skill root
 */
export function indexPathFor(path) {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? path : `${path.slice(0, cut)}/`;
}

/**
 * Editorial one-liners for the consumer's file inventory, keyed by index path,
 * in reading order.
 *
 * Prose only — this is not the inventory. The rows come from the files the
 * packer actually staged into the tarball, and `brandIndex` refuses to render a
 * table when the two disagree in either direction. The list this replaced was
 * itself the inventory, and it omitted `ui_kits/_shared/` for as long as that
 * folder existed: the check that should have caught it compared only first path
 * segments, and `ui_kits` was covered by the four kit rows.
 */
export const BRAND_DESCRIPTIONS = {
  'colors_and_type.css':
    'All brand design tokens — colors, type, spacing, radii, shadow, motion. Import this anywhere.',
  'fonts.css':
    'Self-hosted @font-face for Geist and JetBrains Mono — colors_and_type.css @imports it, so keep them siblings.',
  'fonts/': 'The woff2 files fonts.css loads, with their SIL OFL licenses.',
  'assets/': 'Wordmark, monogram, lockup, dot-grid pattern. SVG-first.',
  'ui_kits/marketing/': 'Marketing site kit (homepage, services, store, portfolio).',
  'ui_kits/webapp/': 'Web app / dashboard kit (auth, sidebar, settings).',
  'ui_kits/mobile/': 'Mobile screen kit.',
  'ui_kits/docs/': 'Docs / long-form reading kit.',
  'ui_kits/_shared/':
    'JSX primitives every kit loads over `../_shared/Primitives.jsx` — a kit copied without it renders nothing.',
  'README.md': 'Brand voice, color, type, and layout rules. Read this first.',
  'SKILL.md': 'This file — the skill entry point.',
};

/**
 * The consumer's file inventory, derived from what shipped rather than declared
 * alongside it. Both directions are errors: a shipped folder with no
 * description would leave a consumer holding files no document mentions, and a
 * description with nothing behind it points at a folder that is not in the
 * tarball.
 *
 * @param {string[]} shipped every file staged into the brand skill, relative to its root
 */
export function brandIndex(shipped) {
  if (shipped.length === 0) {
    throw new Error(
      'brandIndex: the brand skill staged no files, so the inventory would be empty. ' +
        'Check BRAND_SOURCES and the copy step in scripts/build-artifacts.mjs.',
    );
  }

  const rows = new Set(shipped.map(indexPathFor));
  const described = Object.keys(BRAND_DESCRIPTIONS);

  const undescribed = [...rows].filter((path) => !described.includes(path)).sort();
  if (undescribed.length > 0) {
    throw new Error(
      `The brand skill ships ${undescribed.join(', ')}, which BRAND_DESCRIPTIONS in ` +
        'src/artifacts/brand.mjs does not describe, so the generated inventory would omit it.',
    );
  }

  const stale = described.filter((path) => !rows.has(path));
  if (stale.length > 0) {
    throw new Error(
      `BRAND_DESCRIPTIONS describes ${stale.join(', ')}, which the brand skill does not ship — ` +
        'the generated inventory would point a consumer at files they do not have.',
    );
  }

  return described.map((path) => ({ path, description: BRAND_DESCRIPTIONS[path] }));
}

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
 * @param {string[]} input.shipped every file staged into the brand skill, relative to its root
 */
export function transformBrandDocs({ readme, skill, referenceSkill, shipped }) {
  const index = brandIndex(shipped);

  return {
    readme: replaceManagedBlock(readme, renderIndexTable(index), 'design-system-docs/README.md'),
    skill: replaceManagedBlock(
      skill,
      [
        `This skill folder holds: ${index.map((entry) => `\`${entry.path}\``).join(', ')}.`,
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
