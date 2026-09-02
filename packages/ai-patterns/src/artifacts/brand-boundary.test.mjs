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
 *   1. No published file contains a brand term outside a permitted file. "Published" is
 *      whatever each package's own `files` field says, negations included, plus the
 *      `README.md` and `LICENSE` npm adds on its own — read from the manifests, never
 *      restated here.
 *   2. The permitted-file set is exactly the set the doc's table names. Double-entry, so
 *      neither side can move without the other.
 *
 * Assertion 1 said "artifact" and meant it: the scan was `dist/artifacts` and the agent
 * templates, while `files` had said `src` and `dist` all along. Most of published source
 * went unchecked, and a banner naming one consumer survived the run that caught three
 * others (#214). The claim and the check are the same sentence now, which is the only
 * arrangement in which the docblock is worth trusting.
 *
 * The reading of `files` itself moved to published-files.test-helper.mjs when
 * dependency-boundary.test.mjs came to need the same answer (#220). One reader, because
 * npm's negation semantics are subtle enough that a second one would get them wrong in
 * the direction that passes.
 *
 * Two terms are deliberately absent from the denylist, both recorded decisions:
 * "Miltinson Design System" is the system's own name, and `miltinson` is a palette and a
 * pack identifier. Matching is therefore term-plus-context, not bare substring.
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { filesUnder, publishedFiles, repoRoot as repo } from './published-files.test-helper.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/* Nothing in a PNG or a font file can be grepped for a brand term, and reading one as
   utf8 yields mojibake that would match nothing and cost a case each. The filter lives
   here rather than in the shared walk because it is this suite's concern: what
   dependency-boundary.test.mjs can read is a different list, and a shared walk that
   pre-decided for both would be the same "a second list quietly shrinks the scan"
   mistake this file was rewritten to close. */
const READABLE = ({ file }) => !/\.(png|jpg|jpeg|webp|woff2?|ico|svg)$/i.test(file);

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

  describe('no published file asserts one consumer as a rule of the system', () => {
    const published = publishedFiles().filter(READABLE);

    it('found published files to check — run `pnpm build` first', () => {
      expect(published.length).toBeGreaterThan(0);
    });

    /* Permitted source files reach the tarball under their basename, so a built file is
       permitted when its source counterpart is: `design-system-docs/miltinson.voice.json`
       ships as `dist/artifacts/skills/miltinson-design/miltinson.voice.json`.
       Scoped to build output, which is new and load-bearing. The permitted set contains a
       `README.md`, and a basename match reaching checked-in files would hand every
       package README in the repo a permission nobody granted it — the widened scan is the
       first thing to bring package READMEs within range of that mistake. */
    const permittedNames = new Set(permitted.map((path) => path.split('/').pop()));
    const isPermitted = (file) =>
      permitted.includes(file) ||
      (file.includes('/dist/') && permittedNames.has(file.split('/').pop()));

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

    it.each(published)('$file', ({ file, path }) => {
      if (isPermitted(file)) return;
      const raw = readFileSync(path, 'utf8');
      const source = file.endsWith('/brand-manifest.json')
        ? withoutPermittedEntries(raw)
        : withoutVoiceSection(raw);
      expect(BRAND_TERMS.filter((term) => source.includes(term))).toEqual([]);
    });
  });

  /* Subsumed by the scan above while `files` says `src`, and kept anyway: `ds init
     --agents` copies these templates into a consumer's own repo, which is a second
     distribution channel that no `files` field describes. The promise is about the
     templates, not about the tarball that happens to carry them. */
  it('the ds init --agents templates carry no brand at all', () => {
    const templates = filesUnder(join(here, '..', 'agents')).filter((path) =>
      READABLE({ file: path }),
    );
    for (const path of templates) {
      const source = readFileSync(path, 'utf8');
      expect(BRAND_TERMS.filter((term) => source.includes(term))).toEqual([]);
    }
  });
});
