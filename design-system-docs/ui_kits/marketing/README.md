# Marketing UI Kit

A personal-brand or small-company homepage: hero, featured work, a band for a flagship
product line on the inverse surface, services, questions and a sign-up.

**Files**

- `HeaderFooter.jsx` — sticky header with the primary nav and a Button; the footer on the inverse surface
- `Sections.jsx` — `Hero`, `FeaturedApps`, `FeatureBand`, `ServicesBand`, `Questions`, `SignUp`

The Buttons, Cards, Badges, Eyebrows, RuleLinks, Accordion and Input are the real
`@elirobinson/react` components from `../_shared/ds-bundle.js`. Every string comes from
`../_shared/content.js`. Reskinning the kit is an edit to that one file, not to these.

Open `index.html`. The bar at the top sets the theme and the palette.

**Notes**

- Featured-work thumbnails are placeholders, keyed off each entry's `mark` field. Swap them
  for real screenshots.
- `FeatureBand` shows three guide Cards in place of cover art.

**Running it in this repo.** The page needs `../_shared/ds-bundle.js` and `ds-bundle.css`,
which are built, not committed, so `index.html` opened from this folder is blank. Run the
docs site instead: `pnpm --filter docs dev`, then open `/brand/ui-kits/marketing`. It
builds the bundle next to its copy of the kits. The packed brand skill ships with the
bundle in place.
