---
'@elirobinson/react': minor
---

`ChatThread` follows the newest turn, and the `ChatRole` question is answered in prose.

`ChatThread` gains `followNewMessages`, default `true`. As the thread grows the newest turn
is scrolled into view — but only for a reader who is already at the bottom, so scrolling up
to re-read an earlier turn no longer means being yanked back by the next arrival. The
published contract this component was ported from advertised the prop and the acceptance
criterion "follows the newest turn without stealing focus from the composer"; neither had
shipped, and the criterion had not been withdrawn either.

Three details are deliberate. The pinned-to-bottom test measures against the **previous**
commit's scroll height, because by the time a layout effect runs the new turn is already in
the DOM and measuring then reports a pinned reader as one whole turn adrift. The threshold is
a documented constant rather than a token or a prop — it measures nothing on screen, and a
caller who wants to own scrolling has `followNewMessages={false}` and the forwarded ref. And
the scroll is an assignment to `scrollTop`, never `behavior: 'smooth'`: an instant jump has no
motion to reduce, which is why nothing here needs a `prefers-reduced-motion` branch.
`ChatThread.css` now pins `scroll-behavior: auto`, since the property inherits and a
consumer's `html { scroll-behavior: smooth }` would otherwise animate a live region.

The forwarded ref is unchanged: the component holds its own reference and merges the two, so
callers still receive the log element itself.

Separately, `ChatMessage`'s missing `role` union is now recorded as a decision rather than
left as a diff. There is no `ChatRole` and no `role` prop because an author enum is a domain
model the system does not own — three members is wrong for a product with four authors and
wrong again for one with two — and because cutting it removed the thing that made a union
tempting, which was deriving the avatar from the role, the derivation that made `avatar`
required. `docs/agents/components.md` and the `ChatMessage` docs page now carry the reasoning
and the recommended migration for a `role`-shaped caller: keep the union in your own state and
map it to `variant` / `name` / `avatar` at the call site.
