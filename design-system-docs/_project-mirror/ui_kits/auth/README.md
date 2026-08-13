# Auth kit

Seven click-through screens on one split layout — form on white at 400px, ink panel with the dot-grid texture on the right.

Sign in → Create account → Verify code → Reset password → Link sent → SSO wait → Done. Every route in the kit is reachable: submit the sign-in form to see the error state, and the secondary buttons walk the other paths.

**Rules this kit encodes**

- **Password first, alternatives visible.** Magic link and work-account SSO sit under a rule, not hidden behind a "more options" link.
- **Errors name the fix**, never the system: "That didn't work — check the email and password." No codes, no blame.
- **Say what expires and when.** Ten minutes for a code, fifteen for a link, and links work once.
- **One primary action per screen**, ink; secondary is bordered; tertiary is ghost. Amber is never used for a submit button here — auth is not a marketing moment.
- **Real autocomplete tokens** (`email`, `current-password`, `new-password`) and a labelled input per code digit.
- Legal micro-copy is `.t-caption`, below the fold of the form, never a checkbox you must tick.
