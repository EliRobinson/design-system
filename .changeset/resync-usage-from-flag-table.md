---
'@elirobinson/ai-patterns': patch
---

Internal: `ds-resync` generates both commands' `Options:` help from the same flag table it parses with, and the argument handling moved out of `cli.mjs` into a sibling `args.mjs`. Adding a flag is now one edit rather than a table entry plus a matching usage block. The rendered help text is byte-identical, pinned by a test.
