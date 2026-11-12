---
'@elirobinson/react': patch
---

Card, EmptyState, DecisionCard, StubCard, Alert, Toast, Pagination and Breadcrumb keep their own type and list styles inside a host `.prose`. Their headings, paragraphs, description lists and lists now reset under the component root at (0,2,0), as Dialog and Sheet already do. Alert and Toast render their title and description as `div`s, which no host rule reaches, so nothing changes for them today; they get the same reset in case they ever render a heading or paragraph. A consumer that restyled one of these elements with a single class (for example `.ds-card__title`) now needs the root too (`.ds-card .ds-card__title`).
