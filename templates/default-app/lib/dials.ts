/* Dial selection for this app.

   The design system resolves tokens under three independent attributes on the
   root element — `data-palette`, `data-theme` and `data-platform` — and the
   colour dials deliberately do not key off `prefers-color-scheme` in the
   cascade (tokens.css says so at its dark-mode block), so something has to
   write them or this app can only ever render the default combination. This is
   that something.

   One module, deliberately. The pre-paint bootstrap below and any control
   added later both take the storage keys from here, so they cannot disagree
   about what a stored choice is called. A toggle that invented its own key
   would write somewhere the bootstrap never looks, and the visitor's choice
   would survive exactly until the next reload — which reads as "the toggle
   works, but only until you refresh", the least debuggable shape this bug has.

   The roster is read, never restated. `PALETTES` and `THEMES` come from
   `@elirobinson/tokens/dials`, and the guards below and the generated script
   both derive from them, so a palette added in a later release reaches this app
   by bumping `@elirobinson/tokens` and editing nothing. There is no list of
   palette or theme names anywhere in this file, and adding one is the bug. */

import { DEFAULT_PALETTE, DEFAULT_THEME, DIALS, PALETTES, THEMES } from '@elirobinson/tokens/dials';

export const PALETTE_STORAGE_KEY = 'ds-palette';
export const THEME_STORAGE_KEY = 'ds-theme';

/* The attribute that selects each dial, read from the roster for the same
   reason the values are. `DIALS` owns the mapping from a dial's name to its
   attribute; repeating it here would be a second copy to keep in step. */
const ATTRIBUTE = Object.fromEntries(DIALS.map((dial) => [dial.name, dial.attribute]));

/* Neither guard narrows to a union type, and that is not an oversight. A union
   of string literals would have to be typed out by hand, which is the roster
   restated in a place no dependency bump can regenerate, and which goes quietly
   wrong the day a palette is added. The roster is data at runtime, so the guards
   are checks against that data. */

/* No system fallback here, and there must never be one. There is no
   `prefers-*` signal for brand, so anything a fallback picked would be
   invented; and an absent `data-palette` already means the default palette, so
   a stored value that is not in the roster needs no substitute — it needs to be
   ignored. */
export function isPalette(value: unknown): value is string {
  return typeof value === 'string' && PALETTES.includes(value);
}

export function isTheme(value: unknown): value is string {
  return typeof value === 'string' && THEMES.includes(value);
}

/* The one place `prefers-color-scheme` is consulted: as the first-visit
   default, not as the mechanism.

   `prefers-color-scheme: dark` is a CSS keyword, and it only means anything
   here if the roster actually contains a theme by that name — so the name is
   looked up rather than assumed. A roster that dropped or renamed `dark` falls
   back to the default theme instead of writing an attribute value no stylesheet
   declares, and a roster that grows a third theme is unaffected, because the
   media query has nothing to say about it. */
const SYSTEM_DARK_THEME = THEMES.includes('dark') ? 'dark' : DEFAULT_THEME;

/* This app deliberately ships no palette or theme switcher.

   Which dials a product exposes, where the control lives, and whether a visitor
   may change the brand at all are product decisions, and a starter template
   that guessed at them would be shipping someone else's answer. What it ships
   instead is the plumbing, so the answer is a component and not a rewrite.

   A switcher attaches here: a client component that writes
   `PALETTE_STORAGE_KEY` / `THEME_STORAGE_KEY` to localStorage and then applies
   the same attributes this bootstrap applies — set for a non-default value,
   removed for the default. Import `isPalette` / `isTheme` for its options so it
   can only ever store something the bootstrap will accept back. */

/* Runs before first paint, from a blocking inline script in the document head.

   It has to be inline and synchronous: a deferred module would run after the
   first paint, so every visit that is not the default combination would flash
   the default first. The page is rendered on the server, which cannot know the
   visitor's stored choice, so the HTML always ships the default — this is what
   corrects it, before anything is on screen.

   Both storage reads happen before either write, and all four sit in a single
   try. localStorage throws outright when cookies are blocked, and split across
   two try blocks a visitor who chose a non-default palette and a non-default
   theme could have one read throw while the other succeeded — painting one of
   their choices over the default of the other, a combination nobody picked, and
   one that reads as a palette bug rather than as a storage failure. One try,
   one failure mode: either both dials are applied, or the document is left
   exactly as the server sent it, which renders the default and is a perfectly
   good page.

   A dial at its default is removed rather than written, because an absent
   attribute IS the default (`@elirobinson/tokens/dials` implements that rule in
   `dialAttributes`). Writing `data-theme="light"` would render identically and
   would still be a second way to say the same thing, on the one element a
   future switcher reads.

   `data-platform` is deliberately absent from all of this. mobile.css ships a
   `@media (max-width: 480px) and (pointer: coarse)` twin of its attribute
   block, so the platform layer already reaches a phone with no JavaScript at
   all — which is the right mechanism for one document served to everything.
   A scaffolded app cannot know what it is running on, and a client-side guess
   would ship thumb-sized radii and a floored type ramp to a desktop browser
   someone dragged narrow, at a width where the pointer is still a mouse. Do not
   "fix" this by adding a width check. */
export const DIAL_BOOTSTRAP = `(function(){
var palettes=${JSON.stringify(PALETTES)},themes=${JSON.stringify(THEMES)};
var defaultPalette=${JSON.stringify(DEFAULT_PALETTE)},defaultTheme=${JSON.stringify(DEFAULT_THEME)};
function apply(root,attribute,value,fallback){
if(value===fallback){root.removeAttribute(attribute);}else{root.setAttribute(attribute,value);}
}
try{
var root=document.documentElement;
var storedPalette=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});
var storedTheme=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var palette=palettes.indexOf(storedPalette)!==-1?storedPalette:defaultPalette;
var theme=themes.indexOf(storedTheme)!==-1?storedTheme:(window.matchMedia('(prefers-color-scheme: dark)').matches?${JSON.stringify(SYSTEM_DARK_THEME)}:defaultTheme);
apply(root,${JSON.stringify(ATTRIBUTE.palette)},palette,defaultPalette);
apply(root,${JSON.stringify(ATTRIBUTE.theme)},theme,defaultTheme);
}catch(e){}})();`;
