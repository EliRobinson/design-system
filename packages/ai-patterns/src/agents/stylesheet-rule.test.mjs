/* Every file this repo ships to tell an agent how to load the stylesheets says
 * the same thing: import @elirobinson/react/styles.css once, never next to
 * @elirobinson/tokens/tokens.css (styles.css already imports it), and import
 * tokens.css directly only when styles.css is not imported. The rule is written
 * in each file's own voice, so this pins the facts rather than the bytes.
 * contracts.json → token-stylesheet-once is the reason, and
 * @elirobinson/eslint-config's no-duplicate-token-stylesheet the check.
 *
 * It exists because the rule had already drifted: the Cursor rules file said
 * only "stylesheets are imported once" and the Copilot file said nothing, while
 * every other file told apps to import both stylesheets. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { referenceSkillDoc } from '../artifacts/skills.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(repo, path), 'utf8');

const SHIPPED = {
  'agents/AGENTS.md (the managed block)': read('packages/ai-patterns/src/agents/AGENTS.md'),
  'agents/SKILL.md': read('packages/ai-patterns/src/agents/SKILL.md'),
  'agents/design-system.mdc': read('packages/ai-patterns/src/agents/design-system.mdc'),
  'agents/copilot-instructions.md': read('packages/ai-patterns/src/agents/copilot-instructions.md'),
  'prompts/adopt-system.md': read('packages/ai-patterns/src/prompts/adopt-system.md'),
  'resync/SKILL.md': read('packages/ai-patterns/src/resync/SKILL.md'),
  'patterns.md': read('packages/ai-patterns/src/patterns.md'),
  'the generated reference skill': referenceSkillDoc({
    versions: {},
    componentCount: 0,
    hookCount: 0,
  }),
  'templates/default-app/AGENTS.md': read('templates/default-app/AGENTS.md'),
};

/* Prose wraps, so compare on collapsed whitespace. */
const flat = (text) => text.replace(/\s+/g, ' ');

describe.each(Object.entries(SHIPPED))('%s', (_name, text) => {
  it('names react/styles.css as the stylesheet to import', () => {
    expect(flat(text)).toContain('@elirobinson/react/styles.css');
  });

  it('says importing tokens.css as well bundles it twice', () => {
    expect(flat(text)).toMatch(
      /bundles it twice|never next to `@elirobinson\/tokens\/tokens\.css`/,
    );
  });

  it('says when tokens.css is imported directly', () => {
    expect(flat(text)).toMatch(/does not import `styles\.css`/);
  });

  it('never tells an app to import tokens.css and then styles.css', () => {
    expect(flat(text)).not.toMatch(
      /tokens\.css`?,? (?:and|then) `?@elirobinson\/react\/styles\.css/,
    );
  });
});
