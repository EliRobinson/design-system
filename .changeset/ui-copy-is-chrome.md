---
'@elirobinson/ai-patterns': minor
'@elirobinson/eslint-config': minor
---

Add the **UI Copy Is Chrome** rule, and ship a lint rule for the literal half of it.

Functional copy — errors, empty states, helper and hint text, toasts, labels,
button text, tooltips, confirmations, validation — is chrome. It states the fact,
then the consequence, then the action, and stops. The rule names the six ways
that gets padded into marketing: unverifiable frequency claims ("almost always"),
blame attribution ("on their side", "check your connection"), filler pacing ("in
a moment", "hang tight"), unprompted reassurance or apology ("don't worry",
"we'll sort it out"), escalation paths nobody asked for, and enthusiasm ("Great
news!", exclamation marks). Reassurance is allowed only where it answers a
question the reader is actually asking, and only as a fact: "You have not been
charged." Past two short sentences, functional copy is explaining, reassuring, or
selling.

**The rule governs chrome, never a product's editorial voice**, and that
distinction is repeated everywhere the rule appears rather than stated once.
Marketing prose, conversational surfaces, and written deliverables are content;
their voice is a deliberate design decision and this says nothing about them.
Read as an instruction to write plainly everywhere, the rule does more harm than
the padding it removes — which is why it is worth writing down instead of leaving
to taste.

Where it now lives, so a consumer picks it up by upgrading:

- **`pnpm ds patterns`** — as principle 6, and as a line in the **Definition of
  Done for UI work**, which is the checklist agents are told to work before
  calling UI done.
- **`pnpm ds contracts`** — a new `ui-copy` constraint with its own `check` and
  `verifiedBy`.
- **All four agent templates** written by `ds init --agents` (`AGENTS.md`'s
  managed block, the Claude Code skill, the Cursor rule, the Copilot
  instructions), so the next `init` carries it into every consuming repo.
- **`pnpm ds prompts audit-page`** — a seventh check, with editorial content
  explicitly out of scope and wording changes moved to report-don't-fix.

**New ESLint rule: `@elirobinson/no-padded-ui-copy`**, matching those phrases
literally. Its scope is the content/chrome line encoded in code rather than left
to a heuristic: it reads copy props (`title`, `description`, `label`,
`placeholder`, `helperText`, `error`, `tooltip`, `aria-label`, …) and the
children of chrome components (`Alert`, `Toast`, `Tooltip`, `Callout`, `Banner`,
`EmptyState`, `FormMessage`, …). It never reads arbitrary JSX text, so a landing
page's prose is untouched by construction. The cost is that chrome in an
unrecognised component is missed, which is the right way round — a rule that
flagged a product's voice would be switched off within a day.

**It ships as a warning, not an error.** Every repo upgrading into this has copy
written before the rule existed, and a hard error on upgrade would block them.
Raise it once that copy is clean:

```js
export default [...designSystem({ copy: { severity: 'error' } })];
```

`components`, `props` and `allow` options extend or exempt; `severity: 'off'`
switches it off. The two-sentence limit and the content/chrome judgement stay
review, not lint — a length check would fire on legitimately long confirmations
and teach people to disable the rule.

This repo holds itself to it at `error` across `packages/react` and the docs app,
which report zero findings today.
