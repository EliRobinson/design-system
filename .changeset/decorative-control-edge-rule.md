---
'@elirobinson/eslint-config': minor
'@elirobinson/ai-patterns': minor
---

Ship the control-edge contrast rule instead of describing it.

`--border` (1.24:1 against `--bg`) and `--border-strong` (1.53:1) are
decorative on purpose — card seams, table rules, dividers, the edge of a
floating panel. `--border-control` (3.64:1 light, 3.95:1 dark) is the edge that
tells a user where an input, switch, chip, slider, stepper or segmented control
is, which SC 1.4.11 asks to clear 3:1. Both tokens measure correctly on their
own, so a per-token contrast sweep cannot see the mistake: it is a stylesheet
reaching for the wrong one. Inside this repo `component-css.test.mjs` has swept
for it for a while. A consuming app's own stylesheets had nothing but prose.

**What a consumer must do**

1. If you already use the CSS entry point, the rule turns on by itself — it is
   added to the config `designSystemCss()` returns, at whatever `severity` you
   already pass. Just run your lint:

   ```bash
   pnpm eslint .
   ```

   Every new `@elirobinson-css/no-decorative-control-edge` error names the
   selector, the declaration and the token it found.

2. If you are not linting CSS yet, add the entry point (it needs `@eslint/css`,
   which is why it is separate):

   ```js
   // eslint.config.mjs
   import designSystem from '@elirobinson/eslint-config';
   import designSystemCss from '@elirobinson/eslint-config/css';

   export default [...designSystem(), ...designSystemCss()];
   ```

   Point it away from any stylesheet that _defines_ values rather than consuming
   them — your own token layer, vendored CSS — with
   `designSystemCss({ ignores: ['src/styles/tokens.css'] })`.

3. Fix each hit by swapping the token on that declaration. The find/replace is
   mechanical once you have the list:

   ```
   border: 1px solid var(--border)         →  border: 1px solid var(--border-control)
   border-color: var(--border-strong)      →  border-color: var(--border-control)
   ```

   Tailwind users: `border-border` → `border-control` on a control. `border-input`
   already resolves to `--border-control`, so an input using it needs no change.

4. If a flagged selector is genuinely decorative — a floating panel a widget
   opens, an outline badge, a rule under a tab strip — keep the decorative token
   and silence that one line, rather than widening the ignore list:

   ```css
   /* eslint-disable-next-line @elirobinson-css/no-decorative-control-edge */
   border: 1px solid var(--border);
   ```

   The test to apply: if the border were invisible, would the user lose the
   control? Then it is `--border-control`.

**Scope, so you know what will and will not fire**

The rule matches a selector that reads as a control on whole words — `btn`,
`button`, `cta`, `chip`, `action`, `pagination`, `segmented`, `input`, `field`,
`select`, `textarea`, `switch`, `toggle`, `checkbox`, `radio`, `slider`,
`stepper`, `search`, `kbd`, `trigger` — plus the `button`/`input`/`select`/
`textarea` elements and the matching `type=`/`role=` attributes. It is
deliberately narrower than `no-underlined-control-label`: a badge or a tab strip
paints a fill, so an underline inside it is a defect, but its border is trim.
Only colour-bearing border properties are checked, so `border-radius` and
`border-width` are never flagged, and only `var(--border)` / `var(--border-strong)`
are — a hardcoded `#ddd` is `no-hardcoded-design-values`' job.

**Also in this release**

`@elirobinson/ai-patterns/contracts` gains a `control-edge-contrast` entry under
`componentConstraints`, so an agent working in your repo gets the constraint,
its check and what verifies it without reading anyone's docs.
