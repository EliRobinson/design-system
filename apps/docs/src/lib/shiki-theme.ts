import type { ThemeRegistrationRaw } from 'shiki';

/* Brand code theme: ink-led with forest strings and dark-amber constants —
   no purple, per the brand rules.

   Two themes, one scope table. Shiki writes token colours into the markup at
   build time, so a single theme is a single set of literal hexes and the page
   cannot change its mind later: the light hexes stayed put when the root
   element flipped to [data-theme="dark"] and every block rendered ink on ink.
   highlight.ts therefore hands both of these to `codeToHtml`, which emits
   --shiki-light / --shiki-dark custom properties instead, and site.css picks
   between them off the same attribute the tokens use.

   The pair lives in one table rather than two theme objects because the
   failure this fixes is exactly the two halves disagreeing. A scope added to
   one and not the other is not expressible here.

   Every hex is the sRGB conversion of an ink/signal/anchor ramp step (the
   ramps are theme-independent; only the semantics that reference them flip),
   and each column is chosen to clear WCAG AA on the --bg-muted its own theme
   resolves to — --ink-100 #f1f3f4 in light, --ink-900 #040608 in dark. The
   two columns pair the way the token system pairs its own neutrals (light
   --fg-3 is --ink-500, dark --fg-3 is --ink-400), so a role keeps its weight
   across the flip rather than its ramp index. shiki-theme.test.ts measures
   every entry against both backgrounds; it is the gate, not this comment. */

type ScopeRule = {
  scope: string[];
  /** The ramp steps each column is, spelled out for whoever re-derives them. */
  token: { light: string; dark: string };
  light: string;
  dark: string;
  fontStyle?: string;
};

/* The code background in each theme — `--bg-muted`, which site.css also sets
   on the <pre> and which the AA floor below is measured against. */
export const CODE_BACKGROUND = { light: '#f1f3f4', dark: '#040608' } as const;

export const SCOPE_RULES: ScopeRule[] = [
  {
    scope: ['comment', 'punctuation.definition.comment'],
    /* --ink-500 reads as the de-emphasized grey but lands at 4.36:1 on
       --bg-muted: it clears AA against the page (4.85:1 on --bg, which is
       what the token gate measures) and misses it against the slightly
       darker code well. The italic, not a lighter grey, is what marks a
       comment as secondary here. */
    token: { light: '--ink-600', dark: '--ink-400' },
    light: '#494e52',
    dark: '#9b9fa2',
    fontStyle: 'italic',
  },
  {
    scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'],
    token: { light: '--ink-1000', dark: '--ink-0' },
    light: '#000000',
    dark: '#ffffff',
    fontStyle: 'bold',
  },
  {
    scope: ['string', 'string.quoted', 'punctuation.definition.string'],
    token: { light: '--anchor-500', dark: '--anchor-300' },
    light: '#215a3a',
    dark: '#74ad8e',
  },
  {
    scope: [
      'constant',
      'constant.numeric',
      'constant.language',
      'support.constant',
      'variable.other.constant',
    ],
    token: { light: '--signal-700', dark: '--signal-600' },
    light: '#a94608',
    dark: '#d26700',
  },
  {
    scope: ['entity.name.function', 'support.function', 'meta.function-call'],
    token: { light: '--ink-700', dark: '--ink-300' },
    light: '#2a2e33',
    dark: '#ced1d4',
  },
  {
    scope: [
      'entity.name.type',
      'entity.name.class',
      'support.type',
      'support.class',
      'entity.name.tag',
    ],
    token: { light: '--anchor-600', dark: '--anchor-200' },
    light: '#164229',
    dark: '#a5d0b9',
  },
  {
    scope: ['entity.other.attribute-name', 'variable.parameter', 'support.type.property-name'],
    token: { light: '--ink-600', dark: '--ink-400' },
    light: '#494e52',
    dark: '#9b9fa2',
  },
  {
    scope: ['punctuation', 'keyword.operator', 'meta.brace'],
    token: { light: '--ink-600', dark: '--ink-400' },
    light: '#494e52',
    dark: '#9b9fa2',
  },
  {
    scope: ['variable', 'variable.other'],
    token: { light: '--ink-800', dark: '--ink-200' },
    light: '#12171a',
    dark: '#e5e7ea',
  },
];

/* The rules go in `settings`, not in `tokenColors`, and that is load-bearing.

   Both fields work: shiki normalizes a VS Code theme by promoting
   `tokenColors` to `settings` — but only when `settings` is absent
   (normalizeTheme in @shikijs/primitive). `ThemeRegistrationRaw` is the
   TextMate shape and requires `settings`, so a theme written with
   `tokenColors` has to satisfy the type with an empty `settings: []`, which is
   present, which wins, which silently drops every rule. Nothing throws and
   nothing warns: each token falls back to `editor.foreground` and the block
   renders one flat ink, which reads as a deliberately austere theme rather
   than as a theme that was thrown away. Writing the rules where shiki reads
   them removes the promotion step and the trap with it.

   shiki-theme.test.ts highlights a real snippet and counts distinct colours,
   so a monochrome theme fails there rather than in a screenshot. */
function buildTheme(variant: 'light' | 'dark'): ThemeRegistrationRaw {
  return {
    name: `miltinson-${variant}`,
    type: variant,
    colors: {
      'editor.background': CODE_BACKGROUND[variant],
      /* The fallback for anything no scope matched, so it tracks the plain
         identifier colour rather than the page's strongest ink. */
      'editor.foreground': variant === 'light' ? '#12171a' : '#e5e7ea',
    },
    settings: SCOPE_RULES.map(({ scope, fontStyle, ...colors }) => ({
      scope,
      settings: fontStyle
        ? { foreground: colors[variant], fontStyle }
        : { foreground: colors[variant] },
    })),
  };
}

export const miltinsonLight: ThemeRegistrationRaw = buildTheme('light');
export const miltinsonDark: ThemeRegistrationRaw = buildTheme('dark');
