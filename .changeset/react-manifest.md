---
'@elirobinson/react': minor
---

Generate `manifest.json` at build time and export it as `@elirobinson/react/manifest`.

Per component: name, tier, import subpath, the exact import specifier, exported value
names, exported type names, props type name, and variant unions with their allowed values —
whether the union is written inline (`size?: 'sm' | 'md'`) or behind an exported alias
(`variant?: ButtonVariant`). Hooks get the same treatment.

This is the name → subpath map the `no-barrel-imports` contract has always implied was
knowable but never published, and it lets tooling stop regex-parsing `dist/**/*.d.ts`. The
manifest is built from the TypeScript AST, so it is not sensitive to how declarations
happen to be emitted. Discovery walks `src/components` rather than assuming a layout; a
flat directory yields `tier: null` and still works.

Additive: every existing export subpath is unchanged.
