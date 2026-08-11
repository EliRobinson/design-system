---
'@elirobinson/react': major
---

Narrow the `./styles/*` export to `./styles/*.css`.

The subpath was mapped straight onto the components directory:

```json
"./styles/*": "./src/components/*"
```

Anything under `src/components` resolved through it, so
`@elirobinson/react/styles/atoms/Button.tsx` was a valid import — raw,
untranspiled component source reachable through a path named "styles". The map
is now `"./styles/*.css": "./src/components/*.css"`, which serves stylesheets
and nothing else.

**Migration:** every documented and generated specifier already ends in `.css`
(`@elirobinson/react/styles/atoms/Button.css`, and nested sheets like
`@elirobinson/react/styles/organisms/table/core.css`) and is unaffected —
verified against all 45 unique `stylesheetPaths` in the component manifest. If
you were importing anything else through `styles/*`, import the component from
`@elirobinson/react/components/<tier>/<Name>` instead.

**Why `major` and not `minor`.** Serving TSX from `styles/*` was plainly
unintended, and the argument for a smaller bump is real: no consumer can
sensibly have depended on it, and 2.0.0 makes a version wall out of closing a
hole nobody was meant to walk through. It is still a major. A subpath that
resolved yesterday and throws `ERR_PACKAGE_PATH_NOT_EXPORTED` today is a
breaking change to the package's public surface whatever we meant the surface to
be — the exports map _is_ the contract, and intent is not something a consumer's
build can read. The upgrade costs nothing for correct usage, so the honest
version number is cheap here; picking `minor` would buy a tidier changelog with
someone else's broken build.
