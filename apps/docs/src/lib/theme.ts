/* Theme selection for the docs site.

   The design system opts into dark with `[data-theme="dark"]` on the root
   element and does not key off `prefers-color-scheme` (tokens.css), so
   something has to set that attribute or dark mode never appears. This is that
   something, kept in one file so the inline bootstrap and the toggle cannot
   disagree about the storage key. */

export const THEME_STORAGE_KEY = 'ds-theme';

export type Theme = 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/* Runs before first paint, from a blocking inline script in the document head.

   It has to be inline and synchronous: a deferred module would run after the
   first paint, so every visit whose theme is dark would flash a light page
   first. The site is statically prerendered, so the server cannot know the
   visitor's choice and the HTML always ships light — this is what corrects it,
   before anything is on screen.

   Falls back to the system preference on a first visit, which is the one place
   `prefers-color-scheme` is consulted: as the initial default, not as the
   mechanism. Wrapped in try/catch because localStorage throws outright when
   cookies are blocked, and a themeless page is a far better outcome than a
   blank one. */
export const THEME_BOOTSTRAP = `(function(){try{
var stored=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var theme=stored==='light'||stored==='dark'?stored:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
document.documentElement.setAttribute('data-theme',theme);
}catch(e){}})();`;
