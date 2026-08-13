# Search & results kit

Facet rail plus results, with every state the pattern actually has: loading skeletons, results as list or grid, and empty.

**Rules**

- **Applied filters appear as removable chips above the results**, not only as ticked boxes in the rail — people forget what they narrowed.
- **The result count is an `aria-live` line**, so it is announced when the query changes.
- **Empty states say what search covers** and offer one action, never a shrug.
- **Skeletons match the shape of a result row** (title, blurb, meta) rather than generic grey blocks.
- Results are hairline-separated rows in list view — no card per result, which reads as heavier than it is.
- Clear the query to see the empty state; typing re-runs the canned search.
