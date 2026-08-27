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
});

describe('toneSummary', () => {
  it('keeps all four steps, unlike the flattened copy in contracts.json', () => {
    expect(toneSummary(pack)).toBe('practical, honest, warm, quietly confident');
  });
});
