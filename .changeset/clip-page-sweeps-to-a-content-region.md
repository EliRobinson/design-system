---
'@elirobinson/ai-patterns': minor
---

Page sweeps can be clipped to a content region, and site chrome gets its own sweep.

A site whose chrome derives from a registry — a sidebar built from a component list, a nav built from a page map — has a fan-out problem that a full-page sweep turns into noise: one added entry moves pixels on every page at once, so the suite reports one fact N times and every one of those baselines has to be accepted. This repo's own docs project was switched off for it.

Two additions:

- `sweepPages` takes `region`, a selector for the content element each page shot is clipped to. The chrome is then outside the frame, so it cannot fail a page shot — the fan-out is removed rather than suppressed. The capture stays a `fullPage` screenshot with a clip rather than an element screenshot, because Playwright scrolls an element into view before shooting it and a sticky header then paints over the top of the region.
- `sweepChrome` shoots the pieces that left the frame — one test per region per theme, on one route — and names them in a route-shaped `/chrome/*` namespace so they map to a baseline path exactly as a page does.

`regionBox` is exported alongside them. It throws when a selector matches no element, matches several, or matches one with no area: each of those would otherwise degrade into a shot that passes while comparing the wrong thing, or nothing.

No behaviour changes for an existing caller — omitting `region` frames the whole page as before.
