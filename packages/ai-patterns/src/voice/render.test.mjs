import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderVoice, renderVoiceCard, toneSummary } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(
  readFileSync(
    join(here, '..', '..', '..', '..', 'design-system-docs', 'miltinson.voice.json'),
    'utf8',
  ),
);
const shipped = readFileSync(join(here, '__fixtures__', 'content-fundamentals.md'), 'utf8');
const readme = readFileSync(
  join(here, '..', '..', '..', '..', 'design-system-docs', 'README.md'),
  'utf8',
);

describe('the fixture', () => {
  /* The byte test below pins the renderer to the fixture. Nothing else pins the
     fixture to the README it was snapshotted from, so a hand edit to that section
     would leave this file green against a stale copy — the very drift the fixture
     exists to catch, moved one step along.

     The section is generated now, so the two do derive from one source — but
     they derive through `sync-voice.mjs`, and this is the only assertion that
     would catch a renderer whose output the fixture no longer describes being
     written straight into the README. Deleting it in the same change that made
     the section generated would have removed the guard and the thing it guards
     at once, so it stays and compares comment-free text instead: the managed
     markers and the generated note now sit inside the extracted range, exactly
     as they do for `brandVoice`. */
  it('still matches the README section it was captured from', () => {
    const section = readme.match(/^## CONTENT FUNDAMENTALS\s*\n([\s\S]*?)(?=\n## )/m);
    expect(section, 'design-system-docs/README.md has no CONTENT FUNDAMENTALS section').not.toBe(
      null,
    );
    expect(section[1].replace(/<!--[\s\S]*?-->\n?/g, '').trim()).toBe(shipped.trim());
  });
});

describe('renderVoice', () => {
  /* The whole point of PR 2: the pack is a re-hosting of the section, not a rewrite.
     If this fails, the pack lost or gained a word — fix the pack, never the fixture. */
  it('reproduces the shipped CONTENT FUNDAMENTALS section byte for byte', () => {
    expect(renderVoice(pack)).toBe(shipped.trim());
  });

  it('numbers the tone ranking, so the weighting is rendered and not just listed', () => {
    expect(renderVoice(pack)).toContain('1. **Practical**');
    expect(renderVoice(pack)).toContain('4. **Quietly confident**');
  });
});

describe('renderVoiceCard', () => {
  it('carries the whole avoid list, not the half the hand-kept card shipped', () => {
    const card = renderVoiceCard(pack);
    for (const word of ['robust', 'world-class', 'frictionless', 'cutting-edge']) {
      expect(card).toContain(word);
    }
  });

  it('carries the whole use list', () => {
    const card = renderVoiceCard(pack);
    for (const word of pack.words.use) expect(card).toContain(word);
  });

  it('opens with the @dsCard marker the Design System pane indexes on', () => {
    expect(renderVoiceCard(pack).startsWith('<!-- @dsCard ')).toBe(true);
  });

  /* The card that shipped by hand read "Miltinson Technologies". `label` is the
     short mark the README's opening line is pinned to, so the card has to name
     the pack's `fullName` or generating it drops a word off a rendered page. */
  /* The card that shipped by hand opened with this sentence. Generating the
     card is a re-hosting of it, so the sentence has to survive the move. */
  it('opens with the register lead the hand-kept card carried', () => {
    expect(renderVoiceCard(pack)).toContain(pack.person.summary);
  });

  it('names the brand in full in the subtitle, not by the short mark', () => {
    expect(renderVoiceCard(pack)).toContain(`subtitle="${pack.fullName}, sentence case`);
    expect(pack.fullName).not.toBe(pack.label);
  });
});

describe('toneSummary', () => {
  it('keeps all four steps, unlike the flattened copy in contracts.json', () => {
    expect(toneSummary(pack)).toBe('practical, honest, warm, quietly confident');
  });
});
