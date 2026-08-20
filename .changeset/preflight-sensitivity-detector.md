---
'@elirobinson/ai-patterns': minor
---

Add `@elirobinson/ai-patterns/testing/preflight-sweep`, a detector for the class
of bug where a component's rendering depends on a UA-stylesheet default that a
consumer's CSS reset removes.

`findPreflightSensitiveElements(page, { resetCss })` measures every element's
box, applies the reset, measures again, and reports what moved. Both known
instances of this bug shipped through CI green — the default comes from the UA
stylesheet, so the component is correct in Storybook, correct in the docs app,
and correct in jsdom (which does no layout at all), and wrong only with a reset
loaded, which is the configuration every consumer ships.

Consumers can point it at their own build with their own reset; a Tailwind
consumer passes the contents of `tailwindcss/preflight.css`.
