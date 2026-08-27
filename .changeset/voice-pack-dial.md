---
'@elirobinson/ai-patterns': minor
'@elirobinson/design-system-mcp': minor
---

The brand voice is a dial now, and what ships is labelled a default rather than a rule.

`palettes.css` made this move for colour: Miltinson's colours were contributed as a named
palette and amber stayed the default without being a rule, because `data-palette` made
"default" mean something. Prose had no such dial, so the same 51 lines read as the system's
instruction rather than as one pack among possible packs.

A consumer declares its own voice by creating `voice.json` at its repo root — presence is
the declaration, there is no config key. `ds init --voice` scaffolds one and refuses to
overwrite an existing one. `ds voice` prints the pack in force and where it came from.

`get_brand_guidance` and `/llms-full.txt` now name the active pack, and the MCP returns the
consumer's when one is declared. A consumer that declares nothing still gets the full
default pack, not an empty schema: an empty schema would be a real regression in what the
tarball is worth. A malformed consumer pack throws rather than falling back, because
getting someone else's voice silently is the defect this layer closes.
