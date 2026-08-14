---
'@elirobinson/ai-patterns': patch
---

Drop the stray chat screenshot from the shipped brand manifest. `uploads/pasted-1777227214382-0.png` was pasted working material, not brand material, but the `@elirobinson/ai-patterns/brand-manifest` export (`dist/artifacts/brand-manifest.json`, published in `dist`) carried an entry for it under `category: "scratch"`. That entry is gone; a `.gitkeep` entry (same `category: "scratch"`, `origin: "incidental"`, `ships: false`) takes its place so the directory stays present for the manifest generator without tracking pasted files.
