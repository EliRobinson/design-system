# Trello card relations

The board is [Miltinson Design System](https://trello.com/b/ucpG6qr6/miltinson-design-system). Lists: `Backlog`, `Ready`, `In Progress`, `Review`, `Done`.

Card dependencies are **structured text in the card description**, not prose and not Power-Up state. One block, one vocabulary, on every card.

## Why not a relations Power-Up

The board ran the [Card Relations](https://trello.com/power-ups/6985d2ce23e6a232e1cd1c05) Power-Up (Pitagorinesgroup SL) until 2026-09-10. It is **removed** — the board's only plugins now are Custom Fields and Butler. Two facts killed it, and the first rules out every Power-Up of its kind:

1. **The Trello MCP server has no relations API.** `trelloReadCard` / `trelloWriteCard` expose name, desc, due, labels, list, comments and checklists. Power-Up data is not among them, so an agent can never read or write a relation stored in one. This is true of any relations Power-Up, not just that one.
2. **That Power-Up did not even load.** `GET /1/boards/ucpG6qr6/plugins` returned it with `capabilities: [card-buttons, card-badges, card-detail-badges, card-back-section]` but **no `url`**, so Trello had no manifest to fetch. Its card-back button rendered as an empty grey box, and `GET /1/cards/<id>/pluginData` was empty — it had stored nothing.

So the description block is the record. Do not reach for a Power-Up to replace it; reason 1 does not go away. If one is ever installed again for the visual board view, it mirrors the block — the block still wins.

## The block

First thing in every card description, before any other heading:

```markdown
## Relations

- **Parent** — [EPIC](https://trello.com/c/e7eJbW2C)
- **Blocked by** — [F1](https://trello.com/c/B5Hma34V) · [F2](https://trello.com/c/tSLSDPzk)
- **Relates to** — [A1](https://trello.com/c/UqVTLdfW)
```

Rules:

- **Three labels, exactly these.** `Parent`, `Blocked by`, `Relates to`. Do not invent a fourth.
- **`Parent` and `Blocked by` are written once, on the dependent card.** The blocked card names its blocker; the child names its parent. `Relates to` is the exception and goes on both cards, because neither side depends on the other. There is deliberately no `Blocks` line and no `Children` line — a reciprocal pair is two places to keep in sync and one place to drift, and the epic here fans out far enough that the reciprocal lists alone would push cards past the write limit below.
- **To find what a card unblocks, read the board and invert it.** `trelloReadCard` with `action: "list_by_board"` returns every open card and its description in one call, which is enough to rebuild the whole graph.
- **Omit lines that do not apply.** A card with nothing writes `## Relations` then `- **None**`.
- **Every reference is a link** — markdown link to the card's short URL (`https://trello.com/c/<shortLink>`), labelled with the card's code (`F1`, `C4`, `A2`). A card with no code gets a two-or-three-word slug.
- **Separator is `·`** between references on one line.

## What the relations mean

- **Parent** — the epic or umbrella card this one sits under. Structural, not a gate. A parent card is never in `In Progress`; its children are.
- **Blocked by** — this card cannot start until that card is in `Done`. A hard gate. Must stay acyclic: a cycle means the cards are wrongly split, so fix the split rather than record the cycle.
- **Relates to** — shared context, no ordering claim. This is the one label written on **both** cards, because neither side depends on the other. Use it when a decision on one card changes the scope of another. Add one clause after the link when the reason is not obvious.

## Rules for agents

1. **Never state a dependency in prose.** Delete lines like `Depends on **F1**, **F2**.` when you add the block. The block is the only place a dependency lives, so there is nothing to keep in sync.
2. **Every new card gets the block**, including cards with no relations.
3. **A card does not enter `In Progress`** while any `Blocked by` target is outside `Done`.
4. **When you close a card**, read the board, find every card naming it under `Blocked by`, and remove it from their lines. Drop the line entirely when it empties. Nothing does this for you.
5. **When you split or merge cards**, rewrite the block on every card that pointed at them. A dead link is a bug.
6. **Read the whole board before you write.** One `list_by_board` call is cheaper than a wrong edge.

## The 2048-character limit

`trelloWriteCard` caps `desc` at **2048 characters**. Trello itself allows 16384, so a description written through the web UI can grow past the point where the MCP tool can edit it at all. The call is rejected, not truncated.

**Keep every description under 2048 characters.** Give the Relations block its space first; when a card is at the limit, cut prose, never the block. All 22 cards on the board are under the cap today (largest: 2047), and eight of them needed a sentence trimmed to get there. Keep it that way — a card over the cap is a card no agent can edit.

## Verifying

There is no CI gate on this. Before you finish a session that touched relations, re-read the board and check by hand:

- no link points at an archived or deleted card
- no closed card is still named under another card's `Blocked by`
- no card is missing the block
- no `Depends on` prose survives outside the block
