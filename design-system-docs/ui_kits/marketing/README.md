# Marketing UI Kit

A personal-brand or small-company homepage: hero, featured work, a full-bleed band for a
flagship product line, and a two-up services grid.

**Components**

- `HeaderFooter.jsx` — sticky header with primary nav + CTA, ink footer
- `Sections.jsx` — `<Hero />`, `<FeaturedApps />`, `<FeatureBand />`, `<ServicesBand />`
- Uses primitives from `../_shared/Primitives.jsx`: `Wordmark`, `Eyebrow`, `Tag`, `Button`, `RuleLink`

Every string this kit renders comes from `../_shared/content.js`. Reskinning it is an edit
to that one file, not to these.

Open `index.html` to see the assembled homepage.

**Notes**

- Featured-work thumbnails use placeholder visuals, keyed off each entry's `thumb` field —
  emoji on an amber gradient, or a mono equation on ink. Swap with real screenshots when
  available.
- `<FeatureBand />` shows three stylized "guide cards" — replace with real cover art.
