/* The generated design-system-reference skill and the default app's AGENTS.md
 * open their Non-negotiables with the same three bullets, written twice by
 * hand (#440). They cannot share one source: ds-resync regenerates the skill
 * on every upgrade, while the template is copied once, when an app is
 * scaffolded, and must not depend on the skill being installed. So this pins
 * the two copies as equal, apart from the differences each one lists. */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_APP_AGENTS,
  flat,
  read,
  REFERENCE_SKILL,
  referenceSkill,
} from './agent-docs.test-helper.mjs';

/** How many bullets, from the top of each list, the two files share. */
const SHARED = 3;

/** The top-level bullets under `## Non-negotiables`, each on one line. */
const nonNegotiables = (name, text) => {
  const section = text.split(/^## Non-negotiables\n/m)[1]?.split(/^## /m)[0];
  if (!section) throw new Error(`${name} has no ## Non-negotiables section`);
  return section
    .split(/^- /m)
    .slice(1)
    .map((bullet) => flat(bullet).trim());
};

/* Each copy, and the text only it has, by bullet number. By design, the
 * default app names its CSS entry, always has React, and leads the tokens
 * bullet with what to take from tokens. */
const COPIES = [
  {
    name: REFERENCE_SKILL,
    bullets: nonNegotiables(REFERENCE_SKILL, referenceSkill()),
    onlyHere: { 2: ['no React, or '] },
  },
  {
    name: DEFAULT_APP_AGENTS,
    bullets: nonNegotiables(DEFAULT_APP_AGENTS, read(DEFAULT_APP_AGENTS)),
    onlyHere: {
      2: [' (`app/globals.css`)'],
      3: ['Take colours, spacing, radii, shadows, and durations from tokens. '],
    },
  },
];
const [skill, defaultApp] = COPIES;

/** Bullet `n` (1-based) with its copy's own text for that bullet taken out. */
const common = ({ bullets, onlyHere }, n) =>
  (onlyHere[n] ?? []).reduce((text, part) => text.replace(part, ''), bullets[n - 1] ?? '');

describe.each(COPIES.map((copy) => [copy.name, copy]))('%s', (_name, copy) => {
  it(`has at least ${SHARED} Non-negotiables`, () => {
    expect(copy.bullets.length).toBeGreaterThanOrEqual(SHARED);
  });

  it.each(Object.entries(copy.onlyHere).flatMap(([n, parts]) => parts.map((part) => [n, part])))(
    'still has its own text in bullet %s: %j',
    (n, part) => {
      expect(copy.bullets[n - 1]).toContain(part);
    },
  );
});

describe.each(skill.bullets.slice(0, SHARED).map((bullet, i) => [i + 1, bullet.slice(0, 48)]))(
  'Non-negotiable %i ("%s…")',
  (n) => {
    it('says the same in the reference skill and the default app', () => {
      expect(common(defaultApp, n)).toBe(common(skill, n));
    });
  },
);
