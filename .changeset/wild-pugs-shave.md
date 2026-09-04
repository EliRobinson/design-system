---
'@elirobinson/ai-patterns': minor
---

Add a server entry point wrapping AI SDK Core, so a route handler emits the house voice
without copying it.

New subpaths, all additive:

- `@elirobinson/ai-patterns/server` — `streamHouseText`, `toHouseUIMessageResponse`,
  `generateHouseSurface`, `streamHouseSurface`, `assertLanguageModel`, `shapeStreamError`.
  The stream response forwards reasoning and sources and shapes errors into a sentence
  that is safe to render; every default is overridable.
- `@elirobinson/ai-patterns/server/prompt` — `houseSystemPrompt()`, rendered from
  `contracts.json → systemPromptStyle` at run time. A consumer's own `system` string is
  appended to it, never substituted for it, so bumping a version keeps a route current.
- `@elirobinson/ai-patterns/server/tools` — display metadata for AI SDK tools, which
  `tool()` has no room for. `toolDisplayManifest()` renders a tool set as plain JSON a
  client bundle can hold, so a tool panel leads with a label instead of a function name.
- `@elirobinson/ai-patterns/server/surfaces/decision-card`, `…/verdict-badge`,
  `…/stub-card` — a Zod schema and its renderer, exported together. `render()` returns the
  props the matching `@elirobinson/react` component takes, with no mapping step.

`ai` (`>=5.0.0`) and `zod` (`>=3.25.76`) are **optional peer dependencies**: the consumer
owns the version, and the package never ships a second copy of either. Nothing else
changes — no existing subpath moves, and a consumer who does not import `./server…` needs
neither package installed.
