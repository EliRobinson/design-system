/* The templates written by `init --agents`, and the default app's AGENTS.md,
 * share one calm voice: plain rules, no shouting, no bold run-ins, no em
 * dashes. This pins that voice and the facts each file carries, not the bytes,
 * so wording can still change. The stylesheet facts, Tailwind order included,
 * are pinned in stylesheet-rule.test.mjs, not here, and the copy rule's
 * `severity: 'error'` line in cli.test.mjs, over the written files. Only the
 * Cursor rule's `globs:` line is dropped before the voice checks, because it
 * holds `**` globs; descriptions in frontmatter are still checked. */

import { describe, expect, it } from 'vitest';

import { AGENT_FILES } from '../cli/init.mjs';
import { DEFAULT_APP_AGENTS, flat, read, templatePath } from './agent-docs.test-helper.mjs';

const withoutGlobs = (text) => text.replace(/^globs:.*\n/m, '');

const TEMPLATES = AGENT_FILES.map((file) => file.template);

/* Facts every template carries. */
const SHARED = [
  'pnpm ds check',
  'pnpm ds patterns',
  'attribute="data-theme"',
  '[data-theme="dark"]',
  'unlayered',
  '--ds-font-sans-override',
  'does not resolve',
  'worth upstreaming',
  'You have not been charged.',
  'Definition of Done',
  'sanctioned gap-filler',
  'pnpm exec elirobinson-ds',
  'own `variant` / `size` props',
  '@layer base',
  '--ds-font-mono-override',
  'frequency claims',
  'https://github.com/EliRobinson/design-system',
];

const TEMPLATE_FACTS = {
  'AGENTS.md': [
    ...SHARED,
    '@elirobinson/ai-patterns/testing/playwright',
    'blocks foreign UI libraries',
    'You have not been charged. Try again.',
  ],
  'SKILL.md': [
    ...SHARED,
    '@elirobinson/ai-patterns/testing/playwright',
    'You have not been charged. Try again.',
  ],
  'design-system.mdc': [...SHARED],
  'copilot-instructions.md': [...SHARED],
};

/* The default app's own facts: every command and rule it carried before #435. */
const DEFAULT_APP_FACTS = [
  'pnpm ds props <Name>',
  'pnpm ds tokens [filter]',
  'pnpm ds dials',
  'pnpm ds contracts',
  'pnpm ds patterns',
  '"ds": "elirobinson-ds"',
  'pnpm exec elirobinson-ds',
  'pnpm --package=@elirobinson/ai-patterns dlx ds-resync artifacts --write',
  'snapshot is stale',
  'miltinson-design',
  'design-system-reference',
  'do not copy their contents',
  'leaves anything you edited alone',
  'do not add another UI library',
  'does not resolve',
  'app/globals.css',
  '`--ink-500`',
  "absent attribute is that dial's default",
  'lib/dials.ts',
  'conventional commit messages',
];

/* Every voiced file, by repo path, with the facts it carries. */
const FACTS = {
  ...Object.fromEntries(TEMPLATES.map((name) => [templatePath(name), TEMPLATE_FACTS[name]])),
  [DEFAULT_APP_AGENTS]: DEFAULT_APP_FACTS,
};

describe('the template list', () => {
  it('has a fact list for every template init writes', () => {
    expect(Object.keys(TEMPLATE_FACTS).sort()).toEqual([...TEMPLATES].sort());
  });
});

describe.each(Object.keys(FACTS))('%s voice', (path) => {
  const text = withoutGlobs(read(path));

  it('has no em dash', () => {
    expect(text).not.toContain('—');
  });

  it('has no MUST', () => {
    expect(text).not.toMatch(/\bMUST\b/);
  });

  it('has no "never"', () => {
    expect(text).not.toMatch(/\bnever\b/i);
  });

  it('has no bold', () => {
    expect(text).not.toContain('**');
  });
});

describe.each(Object.entries(FACTS))('%s facts', (path, facts) => {
  const text = flat(read(path));

  it.each(facts)('mentions %s', (fact) => {
    expect(text).toContain(fact);
  });
});
