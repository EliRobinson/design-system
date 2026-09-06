---
'@elirobinson/ai-patterns': patch
---

`nextStaticRoutes` no longer hands the visual sweep the routes Next mints from
app-directory icon conventions. Dropping a `favicon.ico`, `icon.png` or
`apple-icon.png` into an app adds a route without adding a page, so the suite
asked for a baseline of the browser's standalone-image viewer. The filter that
already dropped `.txt` and `.json` handlers now covers image, font and manifest
extensions too, keyed on the extension so a page like `/components/icon` is
untouched.
