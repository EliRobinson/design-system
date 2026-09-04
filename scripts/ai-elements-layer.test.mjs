/* The transform layer, held against the two artifacts that describe it.
 *
 * Both assertions here exist because the same failure was reachable twice:
 * the layer gains a rule, and something that CLAIMS to describe the layer in
 * full silently stops being true. Nothing else in the repo reads either
 * artifact back.
 *
 * They live in scripts/ rather than beside the package they check because
 * `scripts/ai-elements-transforms.mjs` is the subject in both cases, and it is
 * a repo-root build script that no package exports. The sibling that pins
 * a11y.mjs to contracts.json (packages/ai-patterns/src/testing/
 * elements-classification-parity.test.mjs) reaches the other way for the same
 * reason.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ruleIds } from './ai-elements-transforms.mjs';

const noticePath = fileURLToPath(new URL('../packages/ai-elements/NOTICE', import.meta.url));
const conversationPath = fileURLToPath(
  new URL('../packages/ai-elements/src/components/conversation.tsx', import.meta.url),
);

describe('the AI Elements transform layer, versus what is published about it', () => {
  /* NOTICE ships in the tarball (packages/ai-elements/package.json `files`),
     and its Modifications section is the Apache-2.0 §4(b) statement of what
     was changed. It says "in full" and then enumerates the rules by id.
     Nothing generates it — it is prose, hand-maintained by whoever adds a rule
     — so until this test the enumeration could go stale silently, and did:
     `reduced-motion` was added to the layer, modified a vendored file, and was
     absent from the list that claims to be complete. That is a false §4(b)
     modification list in a published artifact, not a docs nit. */
  it('names every rule id in the published NOTICE', () => {
    const notice = readFileSync(noticePath, 'utf8');

    // The Modifications section lists each rule as its own bulleted entry:
    //   "  - <id>      <description...>" at the start of a line. A bare
    // substring match would also accept an id that only appears inside prose
    // — `reduced-motion` occurs inside `prefers-reduced-motion`, which is in
    // that rule's own paragraph body — so this anchors to the list-entry
    // shape instead: the id, at the start of a line (allowing for leading
    // whitespace), immediately after a "- " bullet marker.
    for (const id of ruleIds) {
      const listEntry = new RegExp(`^[ \\t]*-[ \\t]+${id}\\b`, 'm');
      expect(
        listEntry.test(notice),
        `NOTICE's "in full" modification list does not mention the "${id}" rule. ` +
          "Add its paragraph — the list is this package's Apache-2.0 section 4(b) statement.",
      ).toBe(true);
    }
  });

  /* The reduced-motion patch, asserted at its landing site rather than only at
     its source. `motion.mjs`'s own `assertPatch` throws when its ANCHOR
     ("initial=\"smooth\"") stops appearing upstream, which is the loud half.
     The quiet half is the other direction: delete the patch entry, or the rule
     that applies it, and `pnpm sync:elements` re-derives a vendored file that
     scrolls smoothly again, exits 0, and three documents (NOTICE, the docs
     page, the changeset) go on saying "instant" with nothing to contradict
     them. Every other patch in the layer is pinned twice — a11y.mjs by the
     contracts parity test and by 576 browser measurements, the skin by the
     visual suite. This is that second pin for motion.

     Asserted on the vendored SOURCE, not on dist: src/ is the file the sync
     check re-derives and the file NOTICE describes. */
  it('leaves the vendored Conversation scrolling instantly, in both directions', () => {
    const source = readFileSync(conversationPath, 'utf8');

    expect(source, 'Conversation no longer scrolls instantly on first paint').toContain(
      'initial="instant"',
    );
    expect(source, 'Conversation no longer scrolls instantly on resize').toContain(
      'resize="instant"',
    );
    expect(source, 'a smooth-scroll default survived the reduced-motion rule').not.toMatch(
      /(?:initial|resize)="smooth"/,
    );
  });
});
