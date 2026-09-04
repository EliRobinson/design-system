# Brand boundary

**The system ships what is inert until chosen, or true under every brand. The consumer
holds anything an agent applies by default with no dial to turn.**

Where a constraint is arguable: it stays in the system only if it can be justified without
naming a brand's character — and then it must be _written_ that way.

## The verdicts

| finding                                              | verdict              | why                                                                      |
| ---------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `[data-palette='miltinson']`                         | system               | inert until selected, and contrast-gated. So is `slate`.                 |
| `[data-palette='slate']`                             | system               | same test, same answer — which is the point                              |
| Miltinson Amber as default                           | system               | a default is a value in a slot with a documented dial                    |
| Geist / JetBrains Mono                               | system               | `--ds-font-*-override` is the dial, enforced by `font-override.test.mjs` |
| 44×44, focus rings, WCAG AA                          | system               | true under every brand                                                   |
| "no left-border accent stripe"                       | system               | craft warrant ("clichéd AI-slop pattern"), no brand named                |
| "no gradients — the brand is honest, not theatrical" | consumer, or rewrite | character warrant. Keep the constraint only with a craft warrant.        |
| the voice rules, as shipped today                    | consumer             | applied by default, no dial                                              |
| the voice rules, as a named pack                     | system default       | inert in the sense that matters: replaceable, and labelled               |

The last two rows are the whole design. The same 51 lines are a boundary violation framed
as `## Brand — these rules make it Miltinson`, and are not one framed as
`## Voice (pack: miltinson — default)`. Fencing removes them; labelling fixes them.

## Named as unsettled

- **Is the avoid list system-level?** `synergy, leverage, unlock, empower` reads as a
  blocklist any product would accept. Promoting it would breach `patterns.md:84`, which
  forbids the chrome rule from reaching editorial voice. Every schema section is marked
  `product` until this is decided on purpose. (#159 open question 1.)
- **Does the tone ranking apply to a consumer's product?** Left open on the same terms.
  (#159 open question 2.)

## Quoting a brand term to explain its removal

A comment that quotes the string it deleted is the clearest kind of comment. In a
published file it is also, still, the string. `@elirobinson/ai-patterns` lists `src` in
`files`, so `src/artifacts/llms.mjs` and `src/voice/schema.mjs` reach the tarball with
their comments intact, and each used the company name as its worked example — one to
explain what the `llms.txt` intro stopped saying, the other to show why a pack carries a
short mark and a legal name as separate fields.

Both were reworded rather than permitted (#214). A placeholder — `<Company>`, `"Acme"` —
carries each lesson whole: that the intro names the system rather than a company, and that
the two name fields exist because the surfaces disagree about which they want. Neither
argument needed the real string; it was there because it was at hand.

Permitting them was the alternative, and it is the weaker one for the reason #145 records.
An exception granted because a file is "only a comment" is the same shape as the exception
that let the voice rules ship as the system's own guidance, and the permitted-file table
below holds because every row in it is a file whose _job_ is to carry a brand's values. A
comment is not that.

## Permitted files

Every other published file is checked against the brand denylist. These are not, because
holding a brand's values is what they are for.

| path                                             | why                                 |
| ------------------------------------------------ | ----------------------------------- |
| `design-system-docs/miltinson.voice.json`        | one voice pack; the shipped default |
| `design-system-docs/guidelines/brand-voice.html` | the same pack, rendered as a card   |
| `design-system-docs/ui_kits/_shared/content.js`  | the kits' strings, in one place     |
| `design-system-docs/README.md`                   | the brand skill's own document      |
| `design-system-docs/SKILL.md`                    | the brand skill's own frontmatter   |

And the published changelogs, on different grounds: a changelog is the record of a change,
not guidance the system gives. An entry quotes the string it removed — that is what makes
it readable — and the release tooling writes it from changesets, so a failure here would
land on a `chore(release)` commit and the only available fix would be to edit shipped
history into a lie about what shipped. `@elirobinson/eslint-config` keeps a changelog and
does not list it in `files`, so it is not published and is not listed here.

| path                                      | why                                          |
| ----------------------------------------- | -------------------------------------------- |
| `packages/ai-elements/CHANGELOG.md`       | published history; generated from changesets |
| `packages/ai-patterns/CHANGELOG.md`       | published history; generated from changesets |
| `packages/design-system-mcp/CHANGELOG.md` | published history; generated from changesets |
| `packages/react/CHANGELOG.md`             | published history; generated from changesets |
| `packages/tokens/CHANGELOG.md`            | published history; generated from changesets |
