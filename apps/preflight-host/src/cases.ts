/* The cases this host renders, as plain data.

   Plain data, with no React and no CSS import, because the visual spec in
   tests/visual/preflight/ imports this file to enumerate its tests, and
   Playwright loads that spec in Node. The components for each case live in
   ./cases/, keyed by the same ids; main.tsx's `Record<PreflightCaseId, …>`
   is what makes a case listed here without a component a type error.

   Each case is a past consumer issue: a way our CSS met Tailwind v4 and its
   Preflight reset and failed with no error. Each one's layout check, in the
   spec, is written to fail if that issue's fix is reverted. */

export type PreflightCase = {
  /** The `?case=` value, and the last segment of the shot's subject. */
  id: string;
  /** The consumer issues this case reproduces. */
  issues: readonly number[];
  /** Set as `data-palette` on <html>, the way a consumer sets the dial. */
  palette?: 'slate';
};

export const PREFLIGHT_CASES = [
  /* #78 and #103: Preflight's `* { margin: 0 }` beat the UA's `dialog:modal
     { margin: auto }`, so every modal rendered in the top-left corner. */
  { id: 'dialog', issues: [78, 103] },
  /* #103: CommandPalette renders inside the same <dialog>, so it had the same
     bug. */
  { id: 'command-palette', issues: [103] },
  /* #126: Preflight makes form controls inherit the body's line-height, so a
     control that declares none grows past its 44px. */
  { id: 'form-controls', issues: [126] },
  /* #112: the bare `a` rule in tokens.css was unlayered, so no Tailwind
     `text-*` utility could colour a link. Slate, because under the default
     palette --link and --accent-fg are both ink and the check would compare
     black with black. */
  { id: 'link-colour', issues: [112], palette: 'slate' },
  /* #251: the `.t-*` type classes set `color` unlayered, so no Tailwind
     `text-*` utility could colour one. */
  { id: 'type-colour', issues: [251] },
  /* #34: a consumer re-points the sans family at a font the framework loaded
     (next/font's shape), through the override hook tokens.css reads first.
     app.css names this id in a `:root:has()` selector, because the override
     must be an unlayered :root rule. Rename it there too. */
  { id: 'font-override', issues: [34] },
] as const satisfies readonly PreflightCase[];

export type PreflightCaseId = (typeof PREFLIGHT_CASES)[number]['id'];

/** The value `?case=` carries for `id`. */
export function caseQuery(id: PreflightCaseId): string {
  return `?case=${encodeURIComponent(id)}`;
}
