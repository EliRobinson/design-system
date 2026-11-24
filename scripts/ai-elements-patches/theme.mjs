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
 * OS prefers dark, and it watches only the `class` attribute on `<html>`. The
 * design system decides differently, in one place: an element is dark when it
 * or any ancestor has `data-theme="dark"` or `.dark`. That is what tokens.css
 * and palettes.css do (bare `[data-theme='dark'], .dark`, inherited), and what
 * the `dark:` variant in tailwind.css matches (`[data-theme='dark'] *`). It
 * never follows the OS on its own, and no `data-theme` value resets a subtree to light, so a
 * `data-theme="light"` inside a dark page is still dark.
 *
 * Upstream's rule drew white on a light page whenever the OS was dark (#442),
 * black on a dark page set by `data-theme` alone (#442), black inside a dark
 * panel on a light page, or under a `data-theme` on `<body>` (#444), and did
 * not follow a runtime switch of `data-theme` (#442).
 *
 * The patches make Persona use the system's rule from its own element: the
 * `<canvas>` that `useRive` already returns. `Persona` passes it to
 * `PersonaWithModel`, which passes it to `useTheme`. `getCurrentTheme(el)` is
 * dark when `el.closest('[data-theme="dark"], .dark')` finds one, and falls
 * back to `<html>` until the canvas exists. The observer watches `class` and
 * `data-theme` on the canvas and every ancestor, and re-reads when the canvas
 * arrives. Upstream's `prefers-color-scheme` listener is left in place: it
 * re-reads the same attributes, so it is harmless.
 *
 * Why anchors and not a wrapper component (#444): the colour is set inside the
 * vendored `PersonaWithModel`, from `useTheme`'s value. A wrapper sees neither,
 * and Persona takes no theme prop, so a wrapper could only re-implement Persona,
 * which is a fork of the whole file. Anchors keep the upstream file and fail
 * loudly by name when it moves.
 *
 * Known limit: the observer watches the ancestors the canvas has when it
 * mounts. If the Persona is moved under a new themed ancestor without
 * remounting, it re-reads on the next change of an attribute it watches, not
 * at the move. Inside a shadow root, `closest()` and the ancestor walk stop at
 * the root, so Persona there reads light even under a dark `<html>`.
 *
 * Same mechanism as `motion.mjs` and `a11y.mjs`: a find/replace on upstream
 * bytes, and `applyAnchoredPatches` (anchored.mjs) throws by name when an
 * anchor does not appear exactly the expected number of times, so an upstream
 * rewrite stops `pnpm sync:elements` loudly instead of dropping the fix.
 */

import { applyAnchoredPatches } from './anchored.mjs';

const PERSONA = 'packages/elements/src/persona.tsx';

/**
 * Every theme patch. `behaviour` is what upstream does today, unpatched, and
 * `why` is the reason the vendored copy does not do that. Each `find` must
 * occur exactly `count` times (default 1) in its file.
 */
export const PATCHES = [
  {
    id: 'persona-theme-reads-nearest-dark-ancestor',
    upstreamPath: PERSONA,
    control: 'persona.tsx — getCurrentTheme()',
    behaviour: 'dark when <html> has .dark, else when the OS prefers dark',
    why:
      'The design system is dark where the element or an ancestor has data-theme="dark" ' +
      'or .dark, and never follows the OS by itself. Reading the OS drew white on a light ' +
      'page; reading only <html> drew black inside a dark panel.',
    find: [
      'const getCurrentTheme = (): "light" | "dark" => {',
      '  if (typeof window !== "undefined") {',
      '    if (document.documentElement.classList.contains("dark")) {',
      '      return "dark";',
      '    }',
      '    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {',
      '      return "dark";',
      '    }',
    ].join('\n'),
    replace: [
      'const getCurrentTheme = (el: Element | null = null): "light" | "dark" => {',
      '  if (typeof window !== "undefined") {',
      '    if ((el ?? document.documentElement).closest(\'[data-theme="dark"], .dark\')) {',
      '      return "dark";',
      '    }',
    ].join('\n'),
  },
  {
    id: 'persona-theme-hook-takes-element',
    upstreamPath: PERSONA,
    control: 'persona.tsx — useTheme() signature',
    behaviour: 'takes no element, so it can only read <html>',
    why: "The nearest themed ancestor needs Persona's own element.",
    find: [
      'const useTheme = (enabled: boolean) => {',
      '  const [theme, setTheme] = useState<"light" | "dark">(getCurrentTheme);',
    ].join('\n'),
    replace: [
      'const useTheme = (enabled: boolean, el: Element | null = null) => {',
      '  const [theme, setTheme] = useState<"light" | "dark">(() => getCurrentTheme(el));',
    ].join('\n'),
  },
  {
    id: 'persona-theme-rereads-from-element',
    upstreamPath: PERSONA,
    control: 'persona.tsx — useTheme() observer and media callbacks',
    behaviour: 're-reads the theme of <html>',
    why: "Both callbacks must re-read from Persona's element, not from <html>.",
    find: '      setTheme(getCurrentTheme());',
    replace: '      setTheme(getCurrentTheme(el));',
    count: 2,
  },
  {
    id: 'persona-theme-observes-ancestors',
    upstreamPath: PERSONA,
    control: 'persona.tsx — useTheme() MutationObserver',
    behaviour: 'watches only the class attribute on <html>',
    why:
      'A switcher that sets data-theme changes no class, and a dark panel is not <html>, ' +
      'so Persona kept its old colour until a reload.',
    find: [
      '    observer.observe(document.documentElement, {',
      '      attributeFilter: ["class"],',
      '      attributes: true,',
      '    });',
    ].join('\n'),
    replace: [
      '    // Any ancestor can make this element dark, so watch them all',
      '    for (',
      '      let node: Element | null = el ?? document.documentElement;',
      '      node;',
      '      node = node.parentElement',
      '    ) {',
      '      observer.observe(node, {',
      '        attributeFilter: ["class", "data-theme"],',
      '        attributes: true,',
      '      });',
      '    }',
      '    // The element can arrive after the first render, so read it now',
      '    setTheme(getCurrentTheme(el));',
    ].join('\n'),
  },
  {
    id: 'persona-theme-effect-tracks-element',
    upstreamPath: PERSONA,
    control: 'persona.tsx — useTheme() effect dependencies',
    behaviour: 'runs once per `enabled`',
    why: 'The canvas is null on the first render, so the effect must run again when it arrives.',
    find: ['  }, [enabled]);', '', '  return theme;'].join('\n'),
    replace: ['  }, [enabled, el]);', '', '  return theme;'].join('\n'),
  },
  {
    id: 'persona-theme-model-takes-canvas',
    upstreamPath: PERSONA,
    control: 'persona.tsx — PersonaWithModelProps',
    behaviour: 'has no element to read the theme from',
    why: 'PersonaWithModel calls useTheme, so it needs the canvas.',
    find: [
      '  source: (typeof sources)[keyof typeof sources];',
      '  children: React.ReactNode;',
      '}',
    ].join('\n'),
    replace: [
      '  source: (typeof sources)[keyof typeof sources];',
      '  canvas?: HTMLCanvasElement | null;',
      '  children: React.ReactNode;',
      '}',
    ].join('\n'),
  },
  {
    id: 'persona-theme-model-passes-canvas',
    upstreamPath: PERSONA,
    control: 'persona.tsx — PersonaWithModel',
    behaviour: 'calls useTheme with no element',
    why: 'Pass the canvas on so the theme comes from where Persona draws.',
    find: [
      '  ({ rive, source, children }: PersonaWithModelProps) => {',
      '    const theme = useTheme(source.dynamicColor);',
    ].join('\n'),
    replace: [
      '  ({ rive, source, canvas, children }: PersonaWithModelProps) => {',
      '    const theme = useTheme(source.dynamicColor, canvas);',
    ].join('\n'),
  },
  {
    id: 'persona-theme-takes-canvas-from-rive',
    upstreamPath: PERSONA,
    control: 'persona.tsx — Persona useRive()',
    behaviour: 'ignores the canvas element useRive returns',
    why: "The canvas is Persona's own element in the page; no extra ref or wrapper needed.",
    find: '    const { rive, RiveComponent } = useRive(',
    replace: '    const { rive, RiveComponent, canvas } = useRive(',
  },
  {
    id: 'persona-theme-passes-canvas',
    upstreamPath: PERSONA,
    control: 'persona.tsx — Persona render',
    behaviour: 'gives the model component no element',
    why: 'PersonaWithModel needs the canvas for useTheme.',
    find: '      <Component rive={rive} source={source}>',
    replace: '      <Component canvas={canvas} rive={rive} source={source}>',
  },
];

function missMessage(patch, expected, found) {
  return (
    `ai-elements theme patch "${patch.id}" expected its anchor ${expected} time(s) in ` +
    `${patch.upstreamPath} and found ${found}.\n\n` +
    `  control:   ${patch.control}\n` +
    `  behaviour: ${patch.behaviour}\n` +
    `  anchor:    ${JSON.stringify(patch.find.slice(0, 120))}\n\n` +
    'Upstream has moved this code. Check whether upstream now reads data-theme from ' +
    "Persona's own element; if not, update the anchor. Do not delete the patch to make " +
    'the bump pass, and do not edit the vendored file directly.'
  );
}

/**
 * Apply every patch that belongs to one upstream file.
 *
 * @param {string} source upstream bytes, after the earlier transform rules
 * @param {string} upstreamPath
 * @returns {{ source: string, fired: boolean }}
 */
export function applyThemePatches(source, upstreamPath) {
  return applyAnchoredPatches(PATCHES, source, upstreamPath, missMessage);
}
