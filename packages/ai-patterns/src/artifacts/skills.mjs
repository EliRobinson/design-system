/* Which skill folders the tarball carries, and the entry point for the one
 * that is generated rather than copied.
 *
 * The directory names are also the `name:` in each SKILL.md frontmatter —
 * Claude Code matches the two, so they are declared once, here.
 *
 * `design-system` is deliberately not in this list: `ds init --agents` already
 * owns `.claude/skills/design-system/`, and clobbering it from a second command
 * would make two features fight over one file.
 */

import { RESYNC_COMMAND, versionStamp } from './llms.mjs';

export const SKILL_DIRS = {
  brand: 'miltinson-design',
  reference: 'design-system-reference',
  resync: 'ds-resync',
};

/**
 * The SKILL.md that fronts the llms snapshot. Generated rather than checked in
 * because the version stamp is the load-bearing part of it, and a checked-in
 * copy would carry last release's numbers.
 *
 * @param {{ versions: object, componentCount: number, hookCount: number }} input
 */
export function referenceSkillDoc({ versions, componentCount, hookCount }) {
  return `---
name: ${SKILL_DIRS.reference}
description: Use this skill when writing UI against the Miltinson Design System (@elirobinson/react, @elirobinson/tokens) — it carries the full component inventory, prop tables, design tokens, and machine-checkable constraints for the versions this repo has installed. Use when adding or changing any screen, component, or style value.
user-invocable: true
---

# Miltinson Design System — component reference

${versionStamp(versions)}

## Files in this skill

- \`llms.txt\` — the index: every component and hook with its one-line description and
  import path. Start here; it is ${componentCount} components and ${hookCount} hooks.
- \`llms-full.txt\` — the full corpus: design tokens with values, the machine-checkable
  constraints, and a prop table for every component and sub-component.

## Read the CLI first, this snapshot second

These files were generated when \`@elirobinson/ai-patterns\` was published. The installed
packages are the authority:

\`\`\`bash
pnpm ds                  # components, exports, variants, hooks, typography, token groups
pnpm ds props <Name>     # props, variant unions, and the exact import line to copy
pnpm ds tokens [filter]  # tokens and values
pnpm ds contracts        # the machine-checkable rules, and what verifies each
\`\`\`

\`pnpm exec elirobinson-ds\` works before the \`ds\` script exists. Use this snapshot when
you want to read the system in bulk, and \`pnpm ds props\` before you write an import.

If \`.claude/ds-artifacts.json\` reports a \`reactVersion\` other than the one installed here,
these files describe a different release. Refresh them:

\`\`\`bash
${RESYNC_COMMAND}
\`\`\`

## Non-negotiables

- Imports name a subpath — \`@elirobinson/react/components/<tier>/<Name>\`. A bare
  \`@elirobinson/react\` import does not resolve.
- \`@elirobinson/tokens/tokens.css\` then \`@elirobinson/react/styles.css\`, once, in the
  app shell. On Tailwind v4 add \`@elirobinson/tokens/tailwind.css\` after them.
- Reference semantic tokens (\`--fg\`, \`--surface\`, \`--accent\`), never raw scale values
  (\`--ink-500\`) in app code.
- Never restyle a system component with overrides that fight the tokens. Report the gap.
`;
}
