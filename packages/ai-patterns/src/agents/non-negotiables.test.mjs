/* The generated design-system-reference skill and the default app's AGENTS.md
 * open their Non-negotiables with the same three bullets, written twice by
 * hand (#440). They cannot share one source: ds-resync regenerates the skill
 * on every upgrade, while the template is copied once, when an app is
 * scaffolded, and must not depend on the skill being installed. So this pins
 * the two copies as equal, apart from the differences each one lists. */

import { describe, expect, it } from 'vitest';

import { referenceSkillDoc } from '../artifacts/skills.mjs';
import { DEFAULT_APP_AGENTS, flat, read } from './agent-docs.test-helper.mjs';

/** How many bullets, from the top of each list, the two files share. */
const SHARED = 3;

/** The top-level bullets under `## Non-negotiables`, each on one line. */
const nonNegotiables = (text) => {
  const section = text.split(/^## Non-negotiables\n/m)[1]?.split(/^## /m)[0];
  if (!section) throw new Error('no ## Non-negotiables section');
  return section
    .split(/^- /m)
    .slice(1)
    .map((bullet) => flat(bullet).trim());
};

/* Each copy's shared bullets, and the text only that copy has, by design: the
 * default app knows its CSS entry, always has React, and leads the tokens
 * bullet with what to take from tokens. */
const skill = {
  bullets: nonNegotiables(
    referenceSkillDoc({ versions: {}, componentCount: 0, hookCount: 0 }),
  ).slice(0, SHARED),
  onlyHere: ['no React, or '],
};
const defaultApp = {
  bullets: nonNegotiables(read(DEFAULT_APP_AGENTS)).slice(0, SHARED),
  onlyHere: [
    ' (`app/globals.css`)',
    'Take colours, spacing, radii, shadows, and durations from tokens. ',
  ],
};
const COPIES = { 'the generated reference skill': skill, [DEFAULT_APP_AGENTS]: defaultApp };

/** A bullet with its copy's own text taken out. */
const common = ({ bullets, onlyHere }, i) =>
  onlyHere.reduce((text, part) => text.replace(part, ''), bullets[i]);

describe.each(Object.entries(COPIES))('%s', (_name, copy) => {
  it(`has at least ${SHARED} Non-negotiables`, () => {
    expect(copy.bullets).toHaveLength(SHARED);
  });

  it.each(copy.onlyHere)('still has its own text %j', (part) => {
    expect(copy.bullets.join(' ')).toContain(part);
  });
});

describe.each(skill.bullets.map((bullet, i) => [i + 1, bullet.slice(0, 48), i]))(
  'Non-negotiable %i ("%s…")',
  (_n, _start, i) => {
    it('says the same in the reference skill and the default app', () => {
      expect(common(defaultApp, i)).toBe(common(skill, i));
    });
  },
);
