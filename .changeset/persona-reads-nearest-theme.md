---
'@elirobinson/ai-elements': patch
---

`Persona` now reads the theme from where it is drawn, not only from `<html>`. It is dark when its own element or any ancestor has `data-theme="dark"` or the `dark` class, the same rule the design system's CSS applies. A Persona inside a dark panel on a light page now draws the dark colour, and so does one in an app that sets `data-theme` on `<body>`. A Persona beside that panel stays light. Changing `data-theme` or the `dark` class on any of those ancestors at runtime updates it. The exported API is unchanged.
