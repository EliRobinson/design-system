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
 * every other file told apps to import both stylesheets.
 *
 * It also pins the Tailwind v4 CSS-entry order, over the files listed in
 * FULL_ORDER and STYLES_CSS_ONLY below, some of which are not in SHIPPED. */

import { describe, expect, it } from 'vitest';

import { referenceSkillDoc } from '../artifacts/skills.mjs';
import { AGENT_FILES } from '../cli/init.mjs';
import { DEFAULT_APP_AGENTS, flat, read, templatePath } from './agent-docs.test-helper.mjs';

/* The templates `init --agents` writes, from AGENT_FILES, so a new template is
 * covered by every test in this file without an edit here. */
const AGENT_TEMPLATES = AGENT_FILES.map(({ template }) => [
  `agents/${template}`,
  read(templatePath(template)),
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
  [DEFAULT_APP_AGENTS]: read(DEFAULT_APP_AGENTS),
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
 * tokens/tailwind.css. Files in FULL_ORDER also put
 * `@elirobinson/tokens/tokens.css` in that slot for an app without styles.css;
 * the snippets in STYLES_CSS_ONLY show only the styles.css case. */
const fromShipped = (name) => {
  if (!(name in SHIPPED)) throw new Error(`${name} is not in SHIPPED`);
  return [name, SHIPPED[name]];
};
const fromPackage = (path) => [path, read(`packages/ai-patterns/src/${path}`)];

const FULL_ORDER = [
  ...AGENT_TEMPLATES,
  fromShipped(DEFAULT_APP_AGENTS),
  fromShipped('the generated reference skill'),
  ['tokens/tailwind.css Usage', read('packages/tokens/src/tailwind.css')],
];
const STYLES_CSS_ONLY = [
  fromShipped('patterns.md'),
  fromPackage('migrate/adopt/tailwind.md'),
  fromPackage('migrate/adopt/shadcn.md'),
];

const TAILWIND = "@import 'tailwindcss'";
const BRIDGE = "@import '@elirobinson/tokens/tailwind.css'";

/* True when `stylesheet` sits between an `@import 'tailwindcss'` and the
 * first bridge import after it. */
const inTheMiddleSlot = (text, stylesheet) => {
  const at = text.indexOf(stylesheet, text.indexOf(TAILWIND));
  const tailwind = text.lastIndexOf(TAILWIND, at);
  return at > -1 && tailwind > -1 && text.indexOf(BRIDGE, tailwind) > at;
};

describe.each([...FULL_ORDER, ...STYLES_CSS_ONLY])('%s', (_name, raw) => {
  it('orders tailwindcss, then react/styles.css, then the Tailwind v4 bridge', () => {
    expect(inTheMiddleSlot(flat(raw), '@elirobinson/react/styles.css')).toBe(true);
  });
});

describe.each(FULL_ORDER)('%s', (_name, raw) => {
  it('puts tokens.css in the same slot when styles.css is not imported', () => {
    expect(inTheMiddleSlot(flat(raw), '@elirobinson/tokens/tokens.css')).toBe(true);
  });
});

/* The templates whose "import styles.css once" rule says, on Tailwind v4, that
 * the app shell import is the CSS entry. SKILL.md and copilot-instructions.md
 * are not listed yet (#436 owns them this cycle). */
describe.each(['agents/AGENTS.md', 'agents/design-system.mdc'].map(fromShipped))(
  '%s',
  (_name, raw) => {
    it('says the app shell import is the CSS entry on Tailwind v4', () => {
      expect(flat(raw)).toMatch(/On Tailwind v4,? (?:that|this) is the CSS entry/);
    });
  },
);
