---
'@elirobinson/ai-patterns': patch
---

`ds tokens color` (or `colour`) now lists every token whose value is a colour, read with the installed tokens package's own colour grammar. Before, it printed `No tokens match "color"`, though the lint messages and the `ds list` hint tell you to run it.
