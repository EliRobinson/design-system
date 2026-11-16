/* The templates written by `init --agents` share one calm voice: plain rules,
 * no shouting, no bold run-ins, no em dashes. This pins that voice and the
 * facts each template carries, not the bytes, so wording can still change.
 * Only the Cursor rule's `globs:` line is dropped before the voice checks,
 * because it holds `**` globs; descriptions in frontmatter are still checked. */

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
  '@elirobinson/tokens/tailwind.css',
  '@elirobinson/react/styles.css',
  'bundles it twice',
  'does not resolve',
  'worth upstreaming',
  'You have not been charged.',
  "designSystem({ copy: { severity: 'error' } })",
  'Definition of Done',
];

const FACTS = {
  'AGENTS.md': [
    ...SHARED,
    '@elirobinson/ai-patterns/testing/playwright',
    'sanctioned gap-filler',
    'blocks foreign UI libraries',
    'You have not been charged. Try again.',
    'pnpm exec elirobinson-ds',
    'https://github.com/EliRobinson/design-system',
  ],
  'SKILL.md': [
    ...SHARED,
    '@elirobinson/ai-patterns/testing/playwright',
    'sanctioned gap-filler',
    'You have not been charged. Try again.',
    'pnpm exec elirobinson-ds',
    'https://github.com/EliRobinson/design-system',
  ],
  'design-system.mdc': [
    ...SHARED,
    'sanctioned gap-filler',
    'pnpm exec elirobinson-ds',
    'https://github.com/EliRobinson/design-system',
  ],
  'copilot-instructions.md': [...SHARED, 'sanctioned gap-filler', 'pnpm exec elirobinson-ds'],
};

describe('the template list', () => {
  it('has a fact list for every template init writes', () => {
    expect(Object.keys(FACTS).sort()).toEqual([...TEMPLATES].sort());
  });
});

describe.each(TEMPLATES)('%s voice', (name) => {
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

  it('puts the Tailwind v4 import after tailwindcss and the design system stylesheet', () => {
    const tailwind = text.indexOf("@import 'tailwindcss'");
    const stylesheet = text.indexOf('@elirobinson/react/styles.css', tailwind);
    const tokens = text.indexOf("@import '@elirobinson/tokens/tailwind.css'", stylesheet);

    expect(tailwind).toBeGreaterThan(-1);
    expect(stylesheet).toBeGreaterThan(tailwind);
    expect(tokens).toBeGreaterThan(stylesheet);
  });
});
