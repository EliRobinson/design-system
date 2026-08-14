import type { Page } from '@playwright/test';

import { THEME_STORAGE_KEY } from '../../apps/docs/src/lib/theme';

/* The design system opts into dark via `[data-theme="dark"]` on the root
   element (tokens.css), with `.dark` accepted as an alias. It does not key off
   `prefers-color-scheme`, so Playwright's `colorScheme` option has no effect
   here and would produce two identical light baselines labelled differently —
   a dark-mode suite that silently tests nothing, which is how #60 shipped. */
export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

/** Must be called before `page.goto` — this registers an init script. */
export async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(
    ({ value, storageKey }) => {
      /* The docs site reads this key in its own pre-paint bootstrap, so seeding
         it drives the shipped code path rather than going around it — the
         snapshot then reflects what a visitor who picked this theme actually
         gets. Storybook has no such bootstrap, which is what the attribute
         below is for; setting both leaves the two in agreement either way. */
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        /* Blocked storage just means the attribute below does the work. */
      }

      const apply = () => document.documentElement?.setAttribute('data-theme', value);

      /* Order matters, and getting it wrong fails silently in the worst
         possible way. Init scripts run at document_start, where
         documentElement may not exist yet: calling apply() first threw, so the
         listener below was never registered and the attribute was never set at
         all. Every "dark" snapshot was then just the light one — a dark-mode
         suite testing nothing, which is how #60 shipped in the first place.

         Register the fallback first, then attempt the immediate set so the
         first paint is already themed when the element is available. */
      document.addEventListener('DOMContentLoaded', apply);
      apply();
    },
    { value: theme, storageKey: THEME_STORAGE_KEY },
  );
}
