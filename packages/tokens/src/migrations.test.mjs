/* The check that stops migrations.json going stale.
 *
 * The manifest is the machine-readable half of a breaking changelog entry, and
 * `ds-resync migrate` rewrites a consumer's files from it. That makes a MISSING
 * entry the dangerous failure: the command reports "nothing to do", the
 * consumer believes it, and a token that silently changed colour ships. A
 * manifest that is trusted and incomplete is worse than no manifest at all.
 *
 * So the entries are not allowed to be the author's memory of what they
 * changed. `rosterDrift` derives what actually moved between the committed
 * baseline and the stylesheets on disk, and every removal and every repoint has
 * to be named by an entry before this file passes.
 *
 * The other direction is checked too, because a manifest can be wrong by
 * pointing somewhere as easily as by omission: a `to` naming a token that does
 * not exist would have `migrate --write` writing a dead variable into a
 * consumer's stylesheet, which is worse than the state it started in.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import migrations from './migrations.json' with { type: 'json' };
import baseline from './token-baseline.json' with { type: 'json' };
import { rosterDrift, tokenRoster } from './token-baseline.mjs';
import { readTokenStylesheets, TOKENS_SRC_DIR } from './token-stylesheets.mjs';

const roster = tokenRoster(readTokenStylesheets());
const drift = rosterDrift(baseline.tokens, roster);

/** Every token any entry claims to migrate. */
const claimed = new Set(migrations.migrations.flatMap((entry) => entry.from));

const ACCEPT = 'node scripts/accept-token-baseline.mjs';

/** The same sentence for both halves of the drift check, because the fix is
 *  the same one and an author reading it should not have to decide which. */
function unaccountedFor(names, what) {
  return [
    `${names.length} token${names.length === 1 ? '' : 's'} ${what} with no migration entry:`,
    ...names.map((name) => `  ${name}`),
    '',
    'A consumer has these in their own CSS and TSX. Add an entry to migrations.json',
    'naming each one in its `from`, then accept the new roster with:',
    `  ${ACCEPT}`,
    '',
    'Run the accept script LAST. Running it first silences this check instead of',
    'satisfying it, and ships a manifest that is trusted and incomplete.',
  ].join('\n');
}

describe('migrations.json accounts for what the stylesheets did', () => {
  it('names every token that was removed', () => {
    const missing = drift.removed.filter((name) => !claimed.has(name));
    expect(missing.length === 0 || unaccountedFor(missing, 'removed')).toBe(true);
  });

  it('names every token whose declared value was repointed', () => {
    const missing = drift.repointed.filter((name) => !claimed.has(name));
    expect(missing.length === 0 || unaccountedFor(missing, 'repointed')).toBe(true);
  });

  /* The baseline is what makes the two checks above mean anything, and it is
     read from a committed file rather than derived, so it can rot on its own.
     A baseline listing a token that never existed would quietly excuse a real
     removal — the drift would name a token the manifest does not have to
     explain, but nobody would be looking. */
  it('is checked against a baseline that was taken from real stylesheets', () => {
    expect(Object.keys(baseline.tokens).length).toBeGreaterThan(100);
    expect(baseline.tokens['--fg']).toBeTruthy();
    expect(baseline.tokens['--status-warning']).toBeTruthy();
  });
});

describe('migrations.json points at tokens that exist', () => {
  const withReplacement = migrations.migrations.filter(
    // A `to` holding `<` is a shape for a human to fill in — `--status-<state>-on`
    // names four tokens and none of them literally. Those are checked below.
    (entry) => entry.to !== null && !entry.to.includes('<'),
  );

  it.each(withReplacement.map((entry) => [entry.id, entry.to]))(
    '%s replaces with %s, which is declared',
    (_id, to) => {
      expect(roster[to]).toBeDefined();
    },
  );

  it('expands every placeholder `to` into tokens that are all declared', () => {
    const states = ['success', 'warning', 'danger', 'info'];

    for (const entry of migrations.migrations) {
      if (entry.to === null || !entry.to.includes('<state>')) continue;
      for (const state of states) {
        expect(roster[entry.to.replace('<state>', state)]).toBeDefined();
      }
    }
  });

  it('only mentions tokens in `when.blockMentions` that are declared', () => {
    for (const entry of migrations.migrations) {
      for (const name of entry.when.blockMentions ?? []) {
        expect(roster[name]).toBeDefined();
      }
    }
  });
});

describe('migrations.json is internally well formed', () => {
  const KINDS = ['rename', 'repoint', 'review', 'removed'];
  const REPORTS = ['occurrence', 'summary', 'none'];

  it('is the manifest for this package', () => {
    expect(migrations.package).toBe('@elirobinson/tokens');
  });

  it('has a unique id per entry', () => {
    const ids = migrations.migrations.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(migrations.migrations.map((entry) => [entry.id, entry]))(
    '%s is complete',
    (_id, entry) => {
      expect(KINDS).toContain(entry.kind);
      expect(REPORTS).toContain(entry.report);
      expect(entry.from.length).toBeGreaterThan(0);
      expect(entry.since).toMatch(/^\d+\.\d+\.\d+$/);
      // Both are printed to a human in the report. An entry with no reason is a
      // find-and-replace with nothing to judge it by.
      expect(entry.reason.length).toBeGreaterThan(40);
      expect(entry.guidance.length).toBeGreaterThan(10);
    },
  );

  /* A rename with no new name is not a rename, and a repoint with one is not a
     repoint — it would be a rename wearing the kind that suppresses rewriting. */
  it.each(migrations.migrations.map((entry) => [entry.id, entry]))(
    '%s has a `to` consistent with its kind',
    (_id, entry) => {
      if (entry.kind === 'rename') expect(entry.to).toBeTruthy();
      if (entry.kind === 'repoint') expect(entry.to).toBeNull();
    },
  );

  /* `report: 'none'` hides a change from the consumer entirely, so it is only
     defensible when there is nothing for them to see. Tying it to `rendered`
     means the silence has to be claimed, not just chosen. */
  it.each(migrations.migrations.filter((entry) => entry.report === 'none').map((e) => [e.id, e]))(
    '%s is only silent because nothing rendered differently',
    (_id, entry) => {
      expect(entry.rendered).toBe('unchanged');
      /* And it must be a repoint. `report` and `kind` are independent fields,
         so a `rename` marked silent would be rewritten in a consumer's files
         and never mentioned in the report — a codemod editing code it does not
         admit to editing. Nothing but a repoint may be silent. */
      expect(entry.kind).toBe('repoint');
    },
  );

  it('ships in the package', () => {
    const manifest = JSON.parse(readFileSync(join(TOKENS_SRC_DIR, '..', 'package.json'), 'utf8'));
    expect(manifest.exports['./migrations']).toBeTruthy();
  });
});
