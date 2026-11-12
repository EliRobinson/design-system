---
'@elirobinson/react': patch
---

The component manifest now lists a variant whose union comes from a relative import. `Tooltip` lists `side` and `DecisionCard` lists `verdict`, each with its values. Their `type` is null, because neither component's module exports the alias.
