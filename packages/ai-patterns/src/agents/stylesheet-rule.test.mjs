/* Every file this repo ships to tell an agent how to load the stylesheets says
 * the same thing: import @elirobinson/react/styles.css once, and not next to
 * @elirobinson/tokens/tokens.css (styles.css already imports it, so that
 * bundles it twice), and import tokens.css directly only when styles.css is
 * not imported. The rule is written in each file's own voice, so this pins the
 * facts rather than the bytes.
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
import { AGENT_FILES } from '../cli/init.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(repo, path), 'utf8');

/* The templates `init --agents` writes, from AGENT_FILES, so a new template is
 * covered by every test in this file without an edit here. */
const AGENT_TEMPLATES = AGENT_FILES.map(({ template }) => [
  `agents/${template}`,
  read(`packages/ai-patterns/src/agents/${template}`),
]);

const SHIPPED = {
  ...Object.fromEntries(AGENT_TEMPLATES),
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

/* The four templates `init --agents` writes also state the Tailwind v4
 * CSS-entry order: tailwindcss, then the design system stylesheet, then
 * tokens/tailwind.css. The other shipped files are tracked in #435. */
describe.each(AGENT_TEMPLATES)('%s', (_name, raw) => {
  const text = flat(raw);

  /* The shared test also accepts "never next to". style-guard.test.mjs bans
   * "never" in these templates, so this adds no coverage today; it pins the
   * calm wording here, with a clearer failure, in case that ban changes. */
  it('says importing tokens.css as well bundles it twice', () => {
    expect(text).toContain('bundles it twice');
  });

  it('orders tailwindcss, then the stylesheet (or tokens.css), then the Tailwind v4 import', () => {
    const tailwind = text.indexOf("@import 'tailwindcss'");
    const stylesheet = text.indexOf('@elirobinson/react/styles.css', tailwind);
    const tokens = text.indexOf("@import '@elirobinson/tokens/tailwind.css'", stylesheet);
    const tokensCss = text.indexOf('@elirobinson/tokens/tokens.css', tailwind);

    expect(tailwind).toBeGreaterThan(-1);
    expect(stylesheet).toBeGreaterThan(tailwind);
    expect(tokens).toBeGreaterThan(stylesheet);
    expect(tokensCss).toBeGreaterThan(tailwind);
    expect(tokensCss).toBeLessThan(tokens);
  });
});
