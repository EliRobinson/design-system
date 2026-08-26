---
'@elirobinson/ai-patterns': minor
'@elirobinson/design-system-mcp': minor
---

The brand voice is Miltinson Technologies, and the royal-we rule is retired.

`Never the royal "we."` was a hard rule in the brand README, and it travelled a long way:
`brandVoice()` extracts the CONTENT FUNDAMENTALS section into `/llms-full.txt`, the packed skill
artifact carries it, and the MCP server serves it from `miltinson://brand/voice` and
`get_brand_guidance`. Every agent building against this system was told the copy must be first
person singular.

That is no longer the rule. The voice is Miltinson Technologies, and whether a product writes "I"
or "we" is that product's decision, taken from what the product is — one name covers a single
person's site and a company product, and both are the brand. "Eli speaks as himself" is now one
legitimate instantiation rather than the rule itself. What replaces the prohibition is a
consistency requirement: pick the person per product and hold it, because the tell of a voice
nobody decided is one that switches partway down a page.

Consumers pinned to the old wording will see it change in the corpus, the skill artifact, and the
MCP resource. Nothing about the API moves.

Refs #130.
