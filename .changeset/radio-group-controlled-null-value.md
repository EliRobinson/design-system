---
'@elirobinson/react': minor
---

A controlled `RadioGroup` can express "nothing selected", and `null` is how it says so.

`const currentValue = value ?? internalValue` conflated two unrelated situations —
"this group is uncontrolled" and "this group is controlled and currently empty" — because
both arrive as a falsy `value`. Controlledness is a property of whether `value` is passed
at all, never of what it happens to hold, so the group now derives it once:

```ts
const isControlled = value !== undefined;
const currentValue = isControlled ? (value ?? undefined) : internalValue;
```

`value` widens from `string` to `string | null`. `null` means controlled with nothing
selected; `undefined` continues to mean uncontrolled. Consumers passing a string, or
passing nothing, are unaffected — which is why this is a minor and not a major, even
though it is a behaviour correction. The widening is the additive half and it is what
sets the bump; the corrected resolution only reaches code that was already passing
`null` and getting the wrong answer for it.

**What actually changes at runtime is narrower than the bug report suggests, and worth
being precise about.** The only input whose handling differs is `value={null}`. It used
to fall through to internal state, so a controlled group handed `null` showed whatever
`defaultValue` said, or whatever an earlier uncontrolled click had left behind, instead
of clearing. Every other input resolves exactly as before.

**Clearing with `undefined` still does not clear the group**, and that is now the
documented convention rather than an accident: `undefined` hands selection back to the
group's own state, which still holds the last click. TypeScript cannot reject it, since
`undefined` is always legal for an optional prop, and a consumer holding
`useState<string | undefined>` reaches for exactly that. So the group now warns in
development when `value` goes from a string to `undefined` — the warning React emits for
the same mistake on a native input, which it never emitted here because the group derives
`checked` itself and React never sees the switch. Type controlled state as
`string | null`.

The controlled path had no test coverage at all, which is how this survived: both
existing cases passed `defaultValue` and neither passed `value`. It now covers
parent-driven value winning over a click, clearing to `null`, the mode boundary and its
warning, and the uncontrolled path from `defaultValue` and from nothing.

Also documents, in the prop table rather than in prose a consumer would have to copy,
that the group participates in native form submission: `RadioGroupItem` renders a real
`input[type="radio"]`, so the group's `name` is the submitted field name and the
selection reaches `FormData` and server actions with no hidden input. A test pins that,
since it is a promise resting on an implementation detail a refactor could quietly drop.
