---
'@elirobinson/tokens': minor
---

Add the muted foregrounds an inverted band was missing.

`--bg-inverse` flips with the theme — that is the point of it, and it is what
keeps a dark hero or footer visible against either page. But the inverse pair
only ever shipped one foreground, `--fg-inverse`. Anything secondary drawn on
such a band had nowhere to go except a fixed ramp step, and a fixed step does
not flip when the surface under it does.

The docs site is the proof. `.home-hero__lead` and `.site-footer__tagline`
used `--ink-300`: 13.7:1 in light, and **1.53:1** in dark once the band turned
white. `.site-footer__meta` on `--ink-400` fell to 2.67:1, and the hero eyebrow
on `--signal-400` to 2.07:1. The footer renders from the root layout, so that
was every page on the site, and there was no correct way to write the CSS —
the tokens for it did not exist.

Three new tokens, each defined in both themes:

- `--fg-inverse-2` — secondary text on `--bg-inverse` (13.73:1 light, 8.45:1 dark)
- `--fg-inverse-3` — tertiary and meta text on `--bg-inverse` (7.87:1 light, 4.85:1 dark)
- `--accent-ink-inverse` — amber that can be read on `--bg-inverse` (10.17:1 light, 9.69:1 dark), the `--accent-ink` of the inverted surface

Each is the mirror theme's own foreground, which is what makes them provable
rather than eyeballed: `--bg-inverse` in one theme is exactly `--bg` in the
other, so their ratio on the band is a ratio the mirror theme already measures
against its page.

They are excepted from the against-`--bg` rule in `contrast.mjs` — `--bg` is
the wrong background for them — and asserted as pairs against `--bg-inverse`
in `contrast.test.mjs`, alongside `--fg-inverse`. The gate that would have
caught this originally now covers the whole inverse family rather than its
primary foreground alone.

Nothing changes in light mode: every ratio there is identical to what it was.
