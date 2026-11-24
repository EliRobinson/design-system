/**
 * The theme half of the AI Elements transform layer: which theme `Persona`
 * draws in.
 *
 * Upstream `Persona` picks its own light or dark in JS, not in CSS. When the
 * variant has `dynamicColor` (`command`, `glint`, `halo`, and the default
 * `obsidian`), that choice sets the Rive model's colour: white in dark, black
 * in light. No stylesheet can reach that colour, so the theme bridge cannot
 * fix it, and the vendored file cannot be hand-edited. This module is the
 * place left.
 *
 * Upstream decides "dark" when `<html>` has the `dark` class, or else when the
 * OS prefers dark, and it watches only the `class` attribute for changes. The
 * design system decides differently, in one place: `[data-theme="dark"]` or
 * `.dark` on `<html>` (tokens.css, palettes.css, and the `dark:` variant in
 * tailwind.css). It never follows the OS on its own. So upstream's rule drew
 * white on a light page whenever the OS was dark and the app had chosen light,
 * drew black on a dark page set by `data-theme` alone, and did not follow a
 * runtime switch of `data-theme` (#442).
 *
 * The patches make Persona use the system's rule: dark when `<html>` has
 * `data-theme="dark"` or the `dark` class, light otherwise, and re-checked
 * when either attribute changes. Upstream's `prefers-color-scheme` listener is
 * left in place: it now re-reads the same attributes, so it is harmless, and
 * leaving it keeps this to two anchors.
 *
 * Same mechanism as `motion.mjs` and `a11y.mjs`: a find/replace on upstream
 * bytes, and `assertPatch` throws by name when an anchor does not appear
 * exactly the expected number of times, so an upstream rewrite of either
 * function stops `pnpm sync:elements` loudly instead of dropping the fix.
 */

/**
 * Every theme patch. `behaviour` is what upstream does today, unpatched, and
 * `why` is the reason the vendored copy does not do that.
 *
 * `count` defaults to 1 and is the number of times `find` must occur in that
 * file.
 */
export const PATCHES = [
  {
    id: 'persona-theme-reads-data-theme',
    upstreamPath: 'packages/elements/src/persona.tsx',
    control: 'persona.tsx — getCurrentTheme()',
    behaviour: 'dark when <html> has .dark, else when the OS prefers dark',
    why:
      'The design system is dark only when <html> has data-theme="dark" or .dark, and ' +
      'never follows the OS by itself. Reading the OS drew white on a light page.',
    find: [
      '    if (document.documentElement.classList.contains("dark")) {',
      '      return "dark";',
      '    }',
      '    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {',
      '      return "dark";',
      '    }',
    ].join('\n'),
    replace: [
      '    const root = document.documentElement;',
      '    if (root.getAttribute("data-theme") === "dark" || root.classList.contains("dark")) {',
      '      return "dark";',
      '    }',
    ].join('\n'),
  },
  {
    id: 'persona-theme-observes-data-theme',
    upstreamPath: 'packages/elements/src/persona.tsx',
    control: 'persona.tsx — useTheme() MutationObserver',
    behaviour: 'watches only the class attribute on <html>',
    why:
      'A switcher that sets data-theme changes no class, so Persona kept its old ' +
      'colour until a reload.',
    find: 'attributeFilter: ["class"],',
    replace: 'attributeFilter: ["class", "data-theme"],',
  },
];

function assertPatch(patch, source) {
  const count = patch.count ?? 1;
  const parts = source.split(patch.find).length - 1;

  if (parts !== count) {
    throw new Error(
      `ai-elements theme patch "${patch.id}" expected its anchor ${count} time(s) in ` +
        `${patch.upstreamPath} and found ${parts}.\n\n` +
        `  control:   ${patch.control}\n` +
        `  behaviour: ${patch.behaviour}\n` +
        `  anchor:    ${JSON.stringify(patch.find.slice(0, 120))}\n\n` +
        'Upstream has moved this code. Check whether upstream now reads data-theme ' +
        'itself; if not, update the anchor. Do not delete the patch to make the bump ' +
        'pass, and do not edit the vendored file directly.',
    );
  }
}

/**
 * Apply every patch that belongs to one upstream file.
 *
 * @param {string} source upstream bytes, after the earlier transform rules
 * @param {string} upstreamPath
 * @returns {{ source: string, fired: boolean }}
 */
export function applyThemePatches(source, upstreamPath) {
  const patches = PATCHES.filter((patch) => patch.upstreamPath === upstreamPath);
  if (patches.length === 0) return { source, fired: false };

  let current = source;
  for (const patch of patches) {
    assertPatch(patch, current);
    current = current.split(patch.find).join(patch.replace);
  }

  return { source: current, fired: true };
}
