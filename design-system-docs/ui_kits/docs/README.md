# Docs / Guide UI Kit

Long-form reading layout for guides, handbooks and documentation:

- a header with a Breadcrumb
- a sticky table of contents (NavigationMenu) beside a reading column held to `--container-md`
- an Alert as the callout, Tabs around a code sample with a copy Button and a `labelOnly` Tooltip, an Accordion of questions, and a Pagination footer

`Guide.jsx` holds the page. The components come from `../_shared/ds-bundle.js`. Every
string comes from `../_shared/content.js`.

Open `index.html` to read a sample chapter. The bar at the top sets the theme and the
palette.

**Running it in this repo.** The page needs `../_shared/ds-bundle.js` and `ds-bundle.css`,
which are built, not committed, so `index.html` opened from this folder is blank. Run the
docs site instead: `pnpm --filter docs dev`, then open `/brand/ui-kits/docs`. It
builds the bundle next to its copy of the kits. The packed brand skill ships with the
bundle in place.
