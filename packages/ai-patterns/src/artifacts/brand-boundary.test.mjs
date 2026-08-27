/* The brand boundary, enforced.
 *
 * docs/agents/brand-boundary.md states the rule: the system ships what is inert until
 * chosen or true under every brand, and the consumer holds anything an agent applies by
 * default with no dial to turn.
 *
 * A rule documented only in prose is a rule that drifts — which is how one consumer's
 * price format, wordmark punctuation and product line came to ship to every other
 * consumer as the design system's own guidance. Two things are asserted, both mechanical:
 *
 *   1. No published artifact contains a brand term outside a permitted file.
 *   2. The permitted-file set is exactly the set the doc's table names. Double-entry, so
 *      neither side can move without the other.
 *
 * Two terms are deliberately absent from the denylist, both recorded decisions:
 * "Miltinson Design System" is the system's own name, and `miltinson` is a palette and a
 * pack identifier. Matching is therefore term-plus-context, not bare substring.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const distArtifacts = join(here, '..', '..', 'dist', 'artifacts');

/* Business facts about one consumer. Not "Miltinson" alone: the system's name contains
   it, and so do the palette and pack identifiers, all three kept on purpose. */
const BRAND_TERMS = [
  'Eli Robinson',
  'miltinsons.com',
  'Kids Recipes',
  'Coaching Guides',
  'From $150/hr',
  'Miltinson Technologies',
  'Builder. Consultant. Founder.',
];

/* Permitted paths, read from the doc's table so the doc and the test cannot disagree.
 *
 * Sliced by index rather than matched with one regex on purpose: `## Permitted files` is
 * the document's last heading, and a `(?=\n## |\n*$)` terminator under the `m` flag ends
 * the section at the first newline — `$` is end-of-LINE there, so the capture comes back
 * empty and every file silently becomes permitted. A guard that permits everything is
 * worse than no guard, so the section is bounded by the next heading or the end of file. */
function permittedFiles() {
  const doc = readFileSync(join(repo, 'docs/agents/brand-boundary.md'), 'utf8');
  const start = doc.indexOf('## Permitted files');
  if (start === -1) throw new Error('brand-boundary.md has no "## Permitted files" section');

  const rest = doc.slice(start + 1);
  const next = rest.indexOf('\n## ');
  const body = next === -1 ? rest : rest.slice(0, next);

  const paths = body
    .split('\n')
    .map((line) => line.match(/^\|\s*`([^`]+)`\s*\|/))
    .filter(Boolean)
    .map((match) => match[1]);

  /* An empty table means the parser broke, not that nothing is permitted. Fail loudly:
     the silent-empty case is the one that turns this whole suite green and meaningless. */
  if (paths.length === 0) {
    throw new Error('brand-boundary.md\'s "## Permitted files" table parsed to zero rows');
  }

  return paths;
}

/* The rendered voice pack, wherever a generated artifact embeds it.
 *
 * Permitted as a SECTION rather than by permitting the files that carry it. The pack's
 * values are one consumer's and they ship on purpose — #145 records the strongest
 * argument against this whole design, that an agent handed only tokens and prop tables
 * writes correct, characterless pages, and returning an empty schema is how that argument
 * would be proved right. What makes it legitimate is that the section names its pack and
 * calls it a default, which llms.test.mjs asserts separately.
 *
 * Permitting `llms-full.txt` outright instead would unguard the largest published
 * artifact and the likeliest place for the next leak — a carve-out wide enough to make
 * this suite decorative. So the section is cut out and everything around it is still
 * checked. */
function withoutVoiceSection(source) {
  const start = source.indexOf('\n## Voice\n');
  if (start === -1) return source;
  const rest = source.slice(start + 1);
  const next = rest.indexOf('\n## ');
  return source.slice(0, start) + (next === -1 ? '' : rest.slice(next));
}

function filesUnder(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    if (/\.(png|jpg|jpeg|webp|woff2?|ico|svg)$/i.test(entry.name)) return [];
    return [path];
  });
}

describe('the brand boundary', () => {
  const permitted = permittedFiles();

  it('reads a non-empty permitted-file table from the doc', () => {
    expect(permitted.length).toBeGreaterThan(0);
  });

  it('permits only files that exist, so the table cannot rot', () => {
    for (const path of permitted) {
      expect(
        statSync(join(repo, path), { throwIfNoEntry: false }),
        `${path} is permitted but does not exist`,
      ).toBeDefined();
    }
  });

  describe('no published artifact asserts one consumer as a rule of the system', () => {
    const built = filesUnder(distArtifacts);

    it('found built artifacts to check — run `nx build ai-patterns` first', () => {
      expect(built.length).toBeGreaterThan(0);
    });

    /* Permitted source files reach the tarball under their basename, so a built file is
       permitted when its source counterpart is. */
    const permittedNames = new Set(permitted.map((path) => path.split('/').pop()));

    /* The brand manifest is an index of the brand artifacts, so it necessarily quotes the
       title and subtitle of each one — including the files permitted to hold this brand's
       values. Permission is inherited per ENTRY rather than granted to the whole file, so
       the manifest stays guarded for the artifacts that are not permitted. */
    const withoutPermittedEntries = (source) => {
      const manifest = JSON.parse(source);
      /* Every path an artifact declares — `entry` on most, `path` on the guideline cards,
         plus its members. Checking one field silently permitted nothing, which passes as a
         failure here rather than a green, but would not have on a different manifest. */
      const declaredPaths = (artifact) =>
        [artifact.entry, artifact.path, ...(artifact.members ?? []).map((member) => member.path)]
          .filter(Boolean)
          .map((path) => `design-system-docs/${path}`);

      return JSON.stringify(
        (manifest.artifacts ?? []).filter(
          (artifact) => !declaredPaths(artifact).some((path) => permitted.includes(path)),
        ),
      );
    };

    it.each(built.map((path) => ({ file: relative(distArtifacts, path), path })))(
      '$file',
      ({ file, path }) => {
        if (permittedNames.has(file.split('/').pop())) return;
        const raw = readFileSync(path, 'utf8');
        const source =
          file === 'brand-manifest.json' ? withoutPermittedEntries(raw) : withoutVoiceSection(raw);
        expect(BRAND_TERMS.filter((term) => source.includes(term))).toEqual([]);
      },
    );
  });

  it('the ds init --agents templates carry no brand at all', () => {
    for (const path of filesUnder(join(here, '..', 'agents'))) {
      const source = readFileSync(path, 'utf8');
      expect(BRAND_TERMS.filter((term) => source.includes(term))).toEqual([]);
    }
  });
});
