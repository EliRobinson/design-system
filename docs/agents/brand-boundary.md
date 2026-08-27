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
