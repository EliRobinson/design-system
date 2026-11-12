---
'@elirobinson/react': minor
---

New hook `@elirobinson/react/hooks/useControllableState`: one value that a consumer either controls (`value`) or leaves to the component (`defaultValue`), with a setter that keeps one identity and always calls the latest `onChange`. `useDisclosure` is now a thin wrapper on it, and Accordion, CommandPalette, RadioGroup, SearchField and Tabs use it in place of their own copies. No component behaviour changes.
