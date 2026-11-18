/* The templates written by `init --agents` share one calm voice: plain rules,
 * no shouting, no bold run-ins, no em dashes. This pins that voice and the
 * facts each template carries, not the bytes, so wording can still change.
 * The stylesheet facts, Tailwind order included, are pinned in
 * stylesheet-rule.test.mjs, not here. Only the Cursor rule's `globs:` line is
 * dropped before the voice checks, because it holds `**` globs; descriptions
 * in frontmatter are still checked. The copy rule's
 * `severity: 'error'` line is pinned in cli.test.mjs, over the written files. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AGENT_FILES } from '../cli/init.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');
const withoutGlobs = (text) => text.replace(/^globs:.*\n/m, '');
/* Prose wraps, so compare on collapsed whitespace. */
const flat = (text) => text.replace(/\s+/g, ' ');

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

const FACTS = {
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

describe('the template list', () => {
  it('has a fact list for every template init writes', () => {
    expect(Object.keys(FACTS).sort()).toEqual([...TEMPLATES].sort());
  });
});

/* The default app's AGENTS.md is not written by init, but it speaks to the
 * same agents, so it keeps the same voice. Its facts are its own. */
const DEFAULT_APP = '../../../../templates/default-app/AGENTS.md';

describe.each([...TEMPLATES, DEFAULT_APP])('%s voice', (name) => {
  const text = withoutGlobs(read(name));

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
  const text = flat(read(name));

  it.each(FACTS[name])('mentions %s', (fact) => {
    expect(text).toContain(fact);
  });
});
