---
'@elirobinson/react': patch
---

Card, EmptyState, DecisionCard, StubCard, Alert, Toast, Pagination and Breadcrumb keep their own type and list styles inside a host `.prose`. Their headings, paragraphs, description lists and lists now reset under the component root at (0,2,0), as Dialog and Sheet already do. A consumer that restyled one of these elements with a single class (for example `.ds-card__title`) now needs the root too (`.ds-card .ds-card__title`).
