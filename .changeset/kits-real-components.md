---
'@elirobinson/ai-patterns': minor
---

The UI kits in the brand skill now render the real `@elirobinson/react` components instead of hand-made look-alikes (#321). The skill ships `ui_kits/_shared/ds-bundle.js` and `ds-bundle.css`, built from react's `dist/`, and every kit loads them. The web app kit covers six screens: dashboard, projects with the command palette, invoices table, assistant, settings and onboarding. Every kit has a bar that sets the theme and the palette, also settable as `?theme=dark&palette=steady`. `_shared/Primitives.jsx` is gone; `_shared/Kit.jsx` holds the bar, the wordmark, the line icons and the layout helpers. `build:design-system-artifact` now outputs the four kits too, pointed at the artifact's own `components/bundle.*`.
