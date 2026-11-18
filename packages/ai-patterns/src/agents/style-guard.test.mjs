/* The templates written by `init --agents`, and the default app's AGENTS.md,
 * share one calm voice: plain rules, no shouting, no bold run-ins, no em
 * dashes. This pins that voice and the facts each file carries, not the bytes,
 * so wording can still change. The stylesheet facts, Tailwind order included,
 * are pinned in stylesheet-rule.test.mjs, not here, and the copy rule's
 * `severity: 'error'` line in cli.test.mjs, over the written files. Only the
 * Cursor rule's `globs:` line is dropped before the voice checks, because it
 * holds `**` globs; descriptions in frontmatter are still checked. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { repoRoot } from '../artifacts/published-files.test-helper.mjs';
import { AGENT_FILES } from '../cli/init.mjs';

const read = (path) => readFileSync(join(repoRoot, path), 'utf8');
const withoutGlobs = (text) => text.replace(/^globs:.*\n/m, '');
/* Prose wraps, so compare on collapsed whitespace. */
const flat = (text) => text.replace(/\s+/g, ' ');

const TEMPLATES = AGENT_FILES.map((file) => file.template);
const templatePath = (name) => `packages/ai-patterns/src/agents/${name}`;

/* Not written by init, but it speaks to the same agents. */
const DEFAULT_APP = 'templates/default-app/AGENTS.md';

/* [label, repo-relative path] for every file whose voice is checked. */
const VOICED = [...TEMPLATES.map((name) => [name, templatePath(name)]), [DEFAULT_APP, DEFAULT_APP]];

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

const FACTS = {
  'AGENTS.md': [
    ...SHARED,
    '@elirobinson/ai-patterns/testing/playwright',
    'blocks foreign UI libraries',
    'On Tailwind v4 that is the CSS entry above.',
    'You have not been charged. Try again.',
  ],
  'SKILL.md': [
    ...SHARED,
    '@elirobinson/ai-patterns/testing/playwright',
    'You have not been charged. Try again.',
  ],
  'design-system.mdc': [...SHARED, 'On Tailwind v4 that is the CSS entry above.'],
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

describe('the template list', () => {
  it('has a fact list for every template init writes', () => {
    expect(Object.keys(FACTS).sort()).toEqual([...TEMPLATES].sort());
  });
});

describe.each(VOICED)('%s voice', (_name, path) => {
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

describe.each(TEMPLATES)('%s facts', (name) => {
  const text = flat(read(templatePath(name)));

  it.each(FACTS[name])('mentions %s', (fact) => {
    expect(text).toContain(fact);
  });
});

describe(`${DEFAULT_APP} facts`, () => {
  const text = flat(read(DEFAULT_APP));

  it.each(DEFAULT_APP_FACTS)('mentions %s', (fact) => {
    expect(text).toContain(fact);
  });
});
