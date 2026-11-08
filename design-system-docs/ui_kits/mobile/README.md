# Mobile UI Kit

Three phone screens, each in a frame with `data-platform="mobile"`, the token layer for
small screens:

- **`BrowseScreen`** — SearchField, filter Buttons, a list of Cards with Badges
- **`PracticeScreen`** — Progress, a RadioGroup of answers, a Button, an Alert with the result
- **`AccountScreen`** — Avatar, Badge, and setting rows whose Switches use `hideLabel`, because the row text already names them

The recipe list is the one place emoji appear, per the brand rules.

The components come from `../_shared/ds-bundle.js`. Every string comes from
`../_shared/content.js`.

Open `index.html` to see the three side by side. The bar at the top sets the theme and the
palette.
