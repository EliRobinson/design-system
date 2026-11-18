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
/* Prose wraps, so compare on collapsed whitespace. */
const flat = (text) => text.replace(/\s+/g, ' ');

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

/* Every shipped file that states the Tailwind v4 CSS-entry order states the
 * same one: tailwindcss, then the design system stylesheet, then
 * tokens/tailwind.css. The third column says whether the file also names
 * `@elirobinson/tokens/tokens.css` in that slot, for an app without styles.css.
 * The prose files and tailwind.css's second Usage block do; the migrate
 * snippets and patterns.md show only the styles.css case. */
const fromShipped = (name, statesFallback) => {
  if (!(name in SHIPPED)) throw new Error(`${name} is not in SHIPPED`);
  return [name, SHIPPED[name], statesFallback];
};
const fromPackage = (path, statesFallback) => [
  path,
  read(`packages/ai-patterns/src/${path}`),
  statesFallback,
];

const TAILWIND_ORDER = [
  ...AGENT_TEMPLATES.map(([name]) => fromShipped(name, true)),
  fromShipped('templates/default-app/AGENTS.md', true),
  fromShipped('the generated reference skill', true),
  fromShipped('patterns.md', false),
  fromPackage('migrate/adopt/tailwind.md', false),
  fromPackage('migrate/adopt/shadcn.md', false),
  ['tokens/tailwind.css Usage', read('packages/tokens/src/tailwind.css'), true],
];

describe.each(TAILWIND_ORDER)('%s', (_name, raw, statesFallback) => {
  const text = flat(raw);
  const tailwind = text.indexOf("@import 'tailwindcss'");
  const bridge = "@import '@elirobinson/tokens/tailwind.css'";

  it('orders tailwindcss, then the stylesheet, then the Tailwind v4 bridge', () => {
    const stylesheet = text.indexOf('@elirobinson/react/styles.css', tailwind);

    expect(tailwind).toBeGreaterThan(-1);
    expect(stylesheet).toBeGreaterThan(tailwind);
    expect(text.indexOf(bridge, stylesheet)).toBeGreaterThan(stylesheet);
  });

  it.runIf(statesFallback)(
    'puts tokens.css in the same slot when styles.css is not imported',
    () => {
      const tokensCss = text.indexOf('@elirobinson/tokens/tokens.css', tailwind);

      expect(tokensCss).toBeGreaterThan(tailwind);
      expect(text.indexOf(bridge, tokensCss)).toBeGreaterThan(tokensCss);
    },
  );
});
