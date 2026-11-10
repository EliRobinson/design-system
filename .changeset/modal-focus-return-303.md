---
'@elirobinson/react': patch
---

Dialog and Sheet now give focus back to the element that opened them when a consumer unmounts them while open (a conditional render). Before, focus fell to the page body. CommandPalette now gets this from the shared modal surface instead of its own copy. Focus that something else took on purpose stays where it is.
