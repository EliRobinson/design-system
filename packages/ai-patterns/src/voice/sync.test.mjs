/* The generated surfaces, checked against the pack.
 *
 * This is the test that makes the pack the single source rather than a fourth copy:
 * it fails when any surface drifts, which is what the four hand-kept copies could
 * never do.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { brandVoice } from '../artifacts/llms.mjs';
import { renderVoice, toneSummary } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const read = (path) => readFileSync(join(repo, path), 'utf8');
const pack = JSON.parse(read('design-system-docs/miltinson.voice.json'));

describe('the generated surfaces match the pack', () => {
  it('sync-voice --check passes, so nothing is stale', () => {
    expect(() =>
      execFileSync('node', ['packages/ai-patterns/scripts/sync-voice.mjs', '--check'], {
        cwd: repo,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('brandVoice still returns the section, with the markers stripped', () => {
    const extracted = brandVoice(read('design-system-docs/README.md'));
    /* Minus the trailing `---`: that rule separates two README sections and
       `brandVoice` has always dropped it, because nothing follows the voice
       rules in the corpus for it to separate them from. Comparing against the
       renderer's full output here would quietly re-introduce it, and the
       corpus would change on the day the section stopped being hand-written —
       the one thing this move is not allowed to do. */
    expect(extracted).toBe(renderVoice(pack).replace(/\n+---$/, ''));
    expect(extracted).not.toContain('ds-artifacts:managed');
  });

  it('the brand guidelines card carries the full avoid list', () => {
    const card = read('design-system-docs/guidelines/brand-voice.html');
    for (const word of pack.words.avoid) expect(card).toContain(word);
  });

  it('the brand guidelines card carries the full use list', () => {
    const card = read('design-system-docs/guidelines/brand-voice.html');
    for (const word of pack.words.use) expect(card).toContain(word);
  });

  /* The card's subtitle is the one rendered surface that names the brand in
     full. It shipped that way by hand, and generating it from `label` would
     have dropped a word off a page without failing anything. */
  it('the card subtitle still names the brand in full', () => {
    expect(read('design-system-docs/guidelines/brand-voice.html')).toContain(
      `subtitle="${pack.fullName}, `,
    );
  });

  it('contracts.json carries all four tone steps', () => {
    const contracts = JSON.parse(read('packages/ai-patterns/src/contracts.json'));
    expect(contracts.systemPromptStyle.voice).toBe(toneSummary(pack));
  });
});
