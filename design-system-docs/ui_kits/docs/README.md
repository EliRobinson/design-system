# Docs / Guide UI Kit

Long-form reading layout for guides, handbooks and documentation:

- a header with a Breadcrumb
- a sticky table of contents (NavigationMenu) beside a reading column held to `--container-md`
- an Alert as the callout, Tabs around a code sample with a copy Button and a `labelOnly` Tooltip, an Accordion of questions, and a Pagination footer

`Guide.jsx` holds the page. The components come from `../_shared/ds-bundle.js`. Every
string comes from `../_shared/content.js`.

Open `index.html` to read a sample chapter. The bar at the top sets the theme and the
palette.
