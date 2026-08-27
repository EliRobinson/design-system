---
'@elirobinson/react': patch
---

A `DropdownMenuItem` that submits a form no longer cancels its own submission.

`<DropdownMenuItem type="submit">` inside a `<form action={…}>` did nothing at all — no
request, no navigation, just a menu that closed. It read as a dead button, and it was the
Sign out control in a real account menu.

The item called `onOpenChange(false)` from its own `onClick`. That is a discrete update, so
React flushes it synchronously before the click dispatch finishes: `AnchoredOverlayContent`
returns `null` and the portal unmounts _during the click that submitted the form_. The submit
event still fires — a native listener on the form sees it — but it fires against a detached
tree, and React has already suppressed the browser's own submission so that it can run the
form's `action` itself. With no live fiber left to run it against, both paths are gone. Any
`onSubmit` handler on that form is lost the same way; this was never specific to server
actions. It was also not fixable from outside the component, because the close was
unconditional and not exposed.

`DropdownMenuItem` now reads its own `type`. An item with `type="submit"` does not close on
select — the click has a default action the consumer wants, and closing is what destroys it.
Every other item closes exactly as before, so nothing about existing menus changes.

The new `closeOnSelect` prop overrides the default in either direction:
`closeOnSelect={false}` keeps an ordinary item's menu open, and `closeOnSelect` on a submit
item closes it anyway. Consumers who took the documented workaround — a plain
`<button type="submit" role="menuitem" className="ds-dropdown__item">` in place of the
component — can now drop back to `DropdownMenuItem`.
