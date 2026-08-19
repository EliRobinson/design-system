/* The schema of migrations.json — what a token migration is, as a type.
 *
 * A migration is the machine-readable half of a breaking changelog entry. The
 * changelog says what happened in prose; this says it in enough structure that
 * `ds-resync migrate` can find the occurrences in a consumer's own CSS and TSX
 * and either fix them or hand the ones it cannot judge to a human.
 *
 * There is deliberately no `was` / `now` value pair here. The previous value
 * lives in token-baseline.json and the current one lives in the stylesheets;
 * duplicating either into this file would give it a third place to go stale.
 */

/** What kind of change this is, which decides whether it can be rewritten. */
export type MigrationKind =
  /** The token was replaced by a differently-named one. Rewritable when the
   *  context in `when` can be established at the occurrence. */
  | 'rename'
  /** The name survived but its value moved. Never rewritable — there is no new
   *  name to write — so every occurrence is reported for a human. */
  | 'repoint'
  /** The token is still valid in general but wrong in the context `when`
   *  describes. Never rewritten: the replacement depends on a fact the tool
   *  cannot see (which fill an element is actually painted with). */
  | 'review'
  /** The token is gone with no replacement. */
  | 'removed';

/** How loudly an occurrence is surfaced. */
export type MigrationReport =
  /** One line per occurrence, with file and position. */
  | 'occurrence'
  /** A count, so a visual diff has an explanation but the report stays short. */
  | 'summary'
  /** Not surfaced at all. Only valid with `rendered: 'unchanged'`. */
  | 'none';

/**
 * The context that narrows a migration to the occurrences it actually applies
 * to. An empty object means "wherever this token appears".
 *
 * Both fields are ANDed. A field that is absent places no constraint; a field
 * that is present but whose value cannot be determined at the occurrence
 * downgrades a rewrite to a review, never to a silent skip.
 */
export type MigrationWhen = {
  /**
   * The CSS properties this applies to, kebab-cased. `borderColor` in a JS
   * style object is normalised to `border-color` before matching.
   *
   * `--status-warning` as a `background` is correct and must be left alone;
   * the same token as a `border-color` must become `--status-warning-border`.
   * That difference is this field.
   */
  properties?: string[];
  /**
   * Other tokens that must appear inside the same `{ … }` — the CSS rule block,
   * or the JS object literal — for this to apply. This is how "text drawn on a
   * status fill" is approximated. It is a heuristic and is only ever used to
   * narrow a `review`, never to authorise a rewrite.
   */
  blockMentions?: string[];
  /**
   * The properties a `blockMentions` token has to be a value OF. Without it,
   * a status token used as a border in the same block counts as "a status fill
   * is under this text", which it is not. With it, the sibling declaration has
   * to actually paint the surface.
   */
  blockProperties?: string[];
};

export type Migration = {
  /** Stable kebab-case identifier. Appears in the report and in the changeset. */
  id: string;
  /** The package version this landed in. A run migrating `from`→`to` applies
   *  every migration with `from < since <= to`. */
  since: string;
  kind: MigrationKind;
  /** The token names this applies to. */
  from: string[];
  /** The replacement, or null when there is none. May be a placeholder such as
   *  `--status-<state>-on`, which is documentation for a human — a `to`
   *  containing `<` is never written into a file. */
  to: string | null;
  /** For `repoint` only: whether the colour a user sees actually moved. */
  rendered?: 'changed' | 'unchanged';
  when: MigrationWhen;
  report: MigrationReport;
  /** Why the change was made. Written for a human reading the report. */
  reason: string;
  /** What the human has to decide, when anything is left to them. */
  guidance: string;
};

export type MigrationManifest = {
  package: string;
  migrations: Migration[];
};

declare const manifest: MigrationManifest;
export default manifest;
