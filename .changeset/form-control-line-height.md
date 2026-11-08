---
'@elirobinson/react': patch
---

`.ds-input` (Input, Select, Textarea) and `.ds-tabs__trigger` now declare `line-height: normal`. Under Tailwind's Preflight they inherited the page's line-height, so inputs, selects and tab triggers grew from 44px to 49px and textareas from 64px to 72px (#126). Without a reset nothing changes: `normal` is the browser default they had before.
