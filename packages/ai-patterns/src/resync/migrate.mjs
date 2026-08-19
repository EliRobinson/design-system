/* Deciding what to do with one occurrence of one token, and doing it.
 *
 * The whole difficulty of a token codemod is that the same token in the same
 * file can be correct and incorrect two lines apart. `--status-warning` as a
 * `background` is exactly right; as a `border-color` it is the 1.87:1 fill
 * being asked to carry a 3:1 job and has to become `--status-warning-border`.
 * A blind rename would break more than it fixed.
 *
 * So there are three verdicts and never two:
 *
 *   rewrite — the context is established and the replacement is unambiguous
 *   review  — something is left for a human, and the file is not touched
 *   ignore  — this occurrence is not what the migration is about
 *
 * `review` is load-bearing. It is what an unknown property, an alias through
 * the consumer's own custom property, or a repointed value with no new name to
 * write all collapse to. `bumpRange` in apply.mjs set the precedent: it returns
 * null for a range it cannot rewrite safely and the caller reports it as
 * skipped, "because rewriting it would silently change the consumer's intent."
 * The same sentence applies here, to a much larger blast radius.
 *
 * Two migrations routinely match the same occurrence, and which one speaks is
 * decided by how narrowly it is aimed, not by which verdict is quieter — see
 * `decide` below, where the first draft of that rule is written up as the bug
 * it was. `--fg-on-signal` is the case worth holding in mind: a plain rename to
 * `--accent-fg` everywhere, except on a status fill, where the answer is a
 * `--status-X-on` only a human can pick. The entry that names the fill is the
 * narrower one, so it wins there and nowhere else.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { IGNORED_DIRECTORIES, SCANNED_EXTENSIONS, scanSource } from './scan.mjs';

/** Why an occurrence was left for a human. One sentence each, because they are
 *  printed next to the line and a reader is deciding, not studying. */
export const REVIEW_REASONS = {
  aliased:
    'the token is assigned to one of your own custom properties, so what it ends up painting is not visible from here',
  unknownProperty:
    'the CSS property could not be established at this position, and this migration only applies to some properties',
  valueChanged: 'the name did not change, only the colour it resolves to',
  contextual: 'the replacement depends on which fill this element is actually painted with',
  removed: 'the token was removed with no direct replacement',
};

/**
 * What one migration says about one occurrence.
 *
 * @returns {{verdict: 'rewrite'|'review'|'ignore', to?: string, reason?: string}}
 */
export function verdictFor(migration, occurrence) {
  const { properties, blockMentions, blockProperties } = migration.when ?? {};

  /* A `blockMentions` constraint narrows before anything else: an occurrence in
     a block that paints nothing relevant is simply not what this is about.
     `blockProperties`, when present, is what separates "a status fill is under
     this text" from "a status token appears somewhere in this block" — a JSX
     style object with a status BORDER and a colour mentions the token without
     painting the fill, and flagging that would be noise. */
  if (blockMentions) {
    const painted = occurrence.blockDeclarations.some(
      (declaration) =>
        blockMentions.includes(declaration.token) &&
        (!blockProperties ||
          (declaration.property !== null && blockProperties.includes(declaration.property))),
    );
    if (!painted) return { verdict: 'ignore' };
  }

  if (properties && occurrence.property !== null && !occurrence.inCustomProperty) {
    if (!properties.includes(occurrence.property)) return { verdict: 'ignore' };
  }

  if (migration.kind === 'repoint') {
    return { verdict: 'review', reason: REVIEW_REASONS.valueChanged };
  }

  if (migration.kind === 'removed') {
    return { verdict: 'review', reason: REVIEW_REASONS.removed };
  }

  if (migration.kind === 'review') {
    return { verdict: 'review', reason: REVIEW_REASONS.contextual };
  }

  // kind === 'rename' from here down.

  /* Through the consumer's own variable, everything downstream is invisible:
     `--my-edge: var(--status-warning)` may be painted as a border in one place
     and a background in another, and this file cannot see either. */
  if (occurrence.inCustomProperty) {
    return { verdict: 'review', reason: REVIEW_REASONS.aliased };
  }

  /* No context required — the old name is wrong everywhere, so the rename is
     safe wherever it appears. */
  if (!properties) return { verdict: 'rewrite', to: migration.to };

  if (occurrence.property === null) {
    return { verdict: 'review', reason: REVIEW_REASONS.unknownProperty };
  }

  return { verdict: 'rewrite', to: migration.to };
}

/**
 * How narrowly a migration is aimed: one point per constraint in `when`.
 *
 * This is what settles the collisions, and there are always collisions — a
 * token that was repointed AND renamed-in-one-context is named by two entries
 * and both of them match. `--status-warning` is the case: `status-brand-coupling`
 * says "this colour moved, look at every use of it" with no constraints, and
 * `warning-needs-an-edge` says "on a border it is now --status-warning-border"
 * with one. On a border the second is the one with something to say.
 */
export function specificityOf(migration) {
  const when = migration.when ?? {};
  return (when.properties ? 1 : 0) + (when.blockMentions ? 1 : 0);
}

/**
 * Every migration's verdict on every occurrence, reduced to one decision per
 * occurrence.
 *
 * The narrower migration wins, and only among equally narrow ones does review
 * beat rewrite. An earlier draft made review beat rewrite unconditionally,
 * which read as the safe rule and was not: a blanket "this colour moved" entry
 * suppressed the specific "on a border, rename it" entry, and the fixture
 * consumer came out with its warning edges untouched and a report telling the
 * reader to go and look at them by hand. Refusing to act is only conservative
 * when there is nothing definite to do.
 */
export function decide(migrations, occurrences) {
  const decisions = [];

  for (const occurrence of occurrences) {
    let chosen = null;
    let chosenScore = -1;

    for (const migration of migrations) {
      if (!migration.from.includes(occurrence.token)) continue;

      const result = verdictFor(migration, occurrence);
      if (result.verdict === 'ignore') continue;

      const score = specificityOf(migration);
      if (score < chosenScore) continue;
      // Equally narrow, and one of them wants a human: the human wins.
      if (score === chosenScore && chosen?.verdict === 'review' && result.verdict !== 'review') {
        continue;
      }

      chosen = { ...result, migration };
      chosenScore = score;
    }

    if (chosen) decisions.push({ ...occurrence, ...chosen, migration: chosen.migration });
  }

  return decisions;
}

/**
 * Applies the rewrites for one file's text.
 *
 * Right to left, so an earlier occurrence's offsets are still valid after a
 * later one has changed length. Only `rewrite` decisions are applied; a review
 * leaves the byte where it was, which is what makes a run that reports reviews
 * still safe to `--write`.
 */
export function rewriteSource(source, decisions) {
  const rewrites = decisions
    .filter((decision) => decision.verdict === 'rewrite')
    .sort((a, b) => b.offset - a.offset);

  let output = source;
  for (const rewrite of rewrites) {
    output = output.slice(0, rewrite.offset) + rewrite.to + output.slice(rewrite.end);
  }

  return output;
}

/** Every file worth scanning under `root`, depth-first, skipping the generated
 *  and vendored trees nobody wants a codemod inside. */
export function collectFiles(root, { ignored = IGNORED_DIRECTORIES } = {}) {
  const found = [];

  const walk = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      // An unreadable directory is not a reason to abandon the run.
      return;
    }

    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (ignored.has(entry.name)) continue;
        walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;
      found.push(path);
    }
  };

  try {
    if (!statSync(root).isDirectory()) return [];
  } catch {
    return [];
  }

  walk(root);
  return found;
}

/**
 * The whole command, minus argument parsing and printing.
 *
 * @param {object} input
 * @param {string} input.cwd repo root, and what paths are reported relative to
 * @param {Array<{name: string, from: string|null, to: string|null, migrations: object[]}>} input.packages
 * @param {boolean} [input.write]
 * @param {(path: string) => string} [input.read] injectable for tests
 * @param {(path: string, contents: string) => void} [input.writeFile]
 * @param {string[]} [input.files] override the file walk
 */
export function runMigrate({
  cwd,
  packages,
  write = false,
  read = (path) => readFileSync(path, 'utf8'),
  writeFile = (path, contents) => writeFileSync(path, contents, 'utf8'),
  files = null,
}) {
  const migrations = packages.flatMap((entry) =>
    entry.migrations.map((migration) => ({ ...migration, package: entry.name })),
  );

  const names = new Set(migrations.flatMap((migration) => migration.from));

  const result = {
    packages: packages.map((entry) => ({
      name: entry.name,
      from: entry.from,
      to: entry.to,
      migrations: entry.migrations.map((migration) => migration.id),
    })),
    filesScanned: 0,
    filesChanged: 0,
    rewrites: [],
    review: [],
    summary: [],
    wrote: write,
  };

  if (names.size === 0) return result;

  const paths = files ?? collectFiles(cwd);
  /* Counted per migration id rather than per occurrence: `report: 'summary'`
     exists so a consumer can explain a visual diff without reading a hundred
     lines about tokens that need no action. */
  const summaryCounts = new Map();

  for (const path of paths) {
    let source;
    try {
      source = read(path);
    } catch {
      continue;
    }

    result.filesScanned += 1;

    const relativePath = relative(cwd, path) || path;
    const decisions = decide(migrations, scanSource(source, relativePath, names));
    if (decisions.length === 0) continue;

    for (const decision of decisions) {
      const record = {
        file: relativePath,
        line: decision.line,
        column: decision.column,
        token: decision.token,
        migration: decision.migration.id,
        package: decision.migration.package,
        property: decision.property,
        text: decision.text,
      };

      /* `report` only ever quietens a REVIEW. A rewrite is an edit to the
         consumer's file, and a codemod that edits a file without saying so is
         indefensible whatever the manifest asked for — so a rewrite is listed
         even if its entry is marked `none`. That is not a hypothetical: the two
         fields are independent, and the invariant should live here rather than
         in another package's test of its own manifest. */
      if (decision.verdict === 'rewrite') {
        result.rewrites.push({ ...record, to: decision.to });
        continue;
      }

      if (decision.migration.report === 'none') continue;

      if (decision.migration.report === 'summary') {
        const key = decision.migration.id;
        const seen = summaryCounts.get(key) ?? { migration: decision.migration, count: 0 };
        seen.count += 1;
        summaryCounts.set(key, seen);
        continue;
      }

      result.review.push({
        ...record,
        to: decision.migration.to,
        reason: decision.reason,
        guidance: decision.migration.guidance,
        why: decision.migration.reason,
      });
    }

    if (!write) continue;

    const rewritten = rewriteSource(source, decisions);
    if (rewritten === source) continue;

    writeFile(path, rewritten);
    result.filesChanged += 1;
  }

  result.summary = [...summaryCounts.values()].map(({ migration, count }) => ({
    migration: migration.id,
    package: migration.package,
    count,
    reason: migration.reason,
    guidance: migration.guidance,
  }));

  return result;
}

const bullet = (line) => `    ${line}`;

/**
 * The human report. Rewrites first because they are the part that is done;
 * reviews last because they are the part that is not, and the last thing on
 * screen is the thing that gets acted on.
 */
export function formatMigrateReport(result) {
  const lines = [];

  const known = result.packages.filter((entry) => entry.migrations.length > 0);

  if (result.packages.length === 0) {
    return [
      'No @elirobinson package here ships a migration manifest.',
      '',
      'Token migrations ship in @elirobinson/tokens from 0.9.0. If you are below that,',
      'the changelog entries from `ds-resync` are the migration notes for this upgrade.',
    ].join('\n');
  }

  for (const entry of result.packages) {
    const range =
      entry.from === null ? `up to ${entry.to ?? 'installed'}` : `${entry.from} → ${entry.to}`;
    lines.push(
      `  ${entry.name}  ${range}  ${entry.migrations.length} migration${
        entry.migrations.length === 1 ? '' : 's'
      }`,
    );
    if (entry.from === null) {
      lines.push(
        bullet('no upgrade record, so every published migration was considered — pass --from'),
        bullet('to narrow it to the versions you actually crossed'),
      );
    }
  }

  lines.push('', `Scanned ${result.filesScanned} file${result.filesScanned === 1 ? '' : 's'}.`, '');

  if (known.length === 0) {
    lines.push('No migrations fall in that range. Nothing to do.');
    return lines.join('\n');
  }

  if (result.rewrites.length > 0) {
    const verb = result.wrote ? 'Rewrote' : 'Would rewrite';
    lines.push(`${verb} ${result.rewrites.length}:`, '');
    for (const item of result.rewrites) {
      lines.push(`  ${item.file}:${item.line}:${item.column}  ${item.token} → ${item.to}`);
      lines.push(bullet(item.text));
    }
    lines.push('');
  }

  if (result.review.length > 0) {
    lines.push(`${result.review.length} left for you — not rewritten, on purpose:`, '');
    for (const item of result.review) {
      lines.push(`  ${item.file}:${item.line}:${item.column}  ${item.token}`);
      lines.push(bullet(item.text));
      lines.push(bullet(`why not: ${item.reason}`));
      if (item.to) lines.push(bullet(`use: ${item.to}`));
      lines.push(bullet(item.guidance));
      lines.push('');
    }
  }

  for (const item of result.summary) {
    lines.push(
      `${item.count} reference${item.count === 1 ? '' : 's'} to tokens whose colour moved (${item.migration}):`,
      bullet(item.guidance),
      '',
    );
  }

  if (result.rewrites.length === 0 && result.review.length === 0 && result.summary.length === 0) {
    lines.push('Nothing in this repo matches those migrations.');
    return lines.join('\n');
  }

  if (!result.wrote && result.rewrites.length > 0) {
    lines.push('Run `ds-resync migrate --write` to apply the rewrites above.');
  }

  if (result.wrote) {
    lines.push(
      `Changed ${result.filesChanged} file${result.filesChanged === 1 ? '' : 's'}. Run your formatter and your tests.`,
    );
  }

  return lines.join('\n');
}
