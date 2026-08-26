import { codeToHtml } from 'shiki';

import { miltinsonDark, miltinsonLight } from './shiki-theme';

/* Both themes, not one.

   Highlighting happens at build time and the result is static markup, so a
   single theme bakes one set of literal hexes into every span and the page has
   no way to answer a theme flip. Handing `codeToHtml` a themes pair makes it
   write --shiki-light / --shiki-dark custom properties instead, and
   `defaultColor: false` stops it also emitting one of the two as a plain
   `color`, which would win over the CSS that has to choose between them.
   That choice lives in site.css, keyed off the same `[data-theme="dark"]` the
   tokens use — the markup here is theme-agnostic on purpose. */
export async function highlight(code: string, lang: string): Promise<string> {
  return codeToHtml(code, {
    lang,
    themes: { light: miltinsonLight, dark: miltinsonDark },
    defaultColor: false,
  });
}
