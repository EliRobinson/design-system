/* The templates written by `init --agents` share one calm voice: plain rules,
 * no shouting, no bold run-ins, no em dashes. This pins that voice and the
 * facts the AGENTS.md block must keep, not the bytes, so wording can still
 * change. Frontmatter is stripped first because the Cursor rule's `globs`
 * line contains `**`. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');
const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '');

const TEMPLATES = ['AGENTS.md', 'SKILL.md', 'design-system.mdc', 'copilot-instructions.md'];

describe.each(TEMPLATES)('%s', (name) => {
  const text = body(read(name));

  it('has no em dash', () => {
    expect(text).not.toContain('—');
  });

  it('does not shout', () => {
    expect(text).not.toMatch(/\bMUST\b/);
    expect(text).not.toMatch(/\bnever\b/i);
  });

  it('has no bold', () => {
    expect(text).not.toContain('**');
  });
});

describe('AGENTS.md keeps its facts', () => {
  const text = read('AGENTS.md');

  it.each([
    'attribute="data-theme"',
    'unlayered',
    '@elirobinson/ai-patterns/testing/playwright',
    'pnpm ds check',
    'pnpm ds patterns',
    "designSystem({ copy: { severity: 'error' } })",
    '@elirobinson/tokens/tailwind.css',
  ])('mentions %s', (fact) => {
    expect(text).toContain(fact);
  });
});
