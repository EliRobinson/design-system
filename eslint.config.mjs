import designSystem, { mcpStdio, plugin as designSystemPlugin } from '@elirobinson/eslint-config';
import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * The vendored AI Elements tree, which is nobody's to edit.
 *
 * Every file under it is written by `pnpm sync:elements` from the pinned
 * upstream release, so a lint FIX applied to one is reverted by the next bump —
 * and until then it reads as local divergence and makes that bump fail as a
 * conflict, which is the whole point of the sync check. So the general rule set
 * is kept off it, and this is spelled as a per-config `ignores` rather than a
 * global one so that exactly one rule can be pointed back at it below.
 * (Measured at ai-elements@1.9.0: 3 no-unused-vars errors, all on deliberate
 * `_`-prefixed discards upstream keeps for documentation.) Our own rules still
 * apply to code we can actually change: the package's scripts/ and types/ are
 * NOT covered by this.
 */
const VENDORED_ELEMENTS = ['packages/ai-elements/src/**'];

/** `config` with VENDORED_ELEMENTS added to whatever it already ignores. */
const offVendoredElements = (config) => ({
  ...config,
  ignores: [...(config.ignores ?? []), ...VENDORED_ELEMENTS],
});

export default tseslint.config(
  {
    ignores: [
      // Globbed rather than root-anchored: this is a pnpm workspace, so both
      // of these also exist inside each package (packages/react/dist, etc.),
      // and a root-anchored pattern lints generated output.
      '**/node_modules/**',
      '**/dist/**',
      // Agent worktrees contain a full second copy of the repo.
      '.claude/**',
      'apps/storybook/storybook-static/**',
      'apps/docs/.next/**',
      'design-system-docs/**',
      // Staged copies of the same brand material, served by the docs site.
      'apps/docs/public/brand/**',
      '.nx/**',
    ],
  },
  offVendoredElements(js.configs.recommended),
  ...tseslint.configs.recommended.map(offVendoredElements),
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    ignores: VENDORED_ELEMENTS,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // The MCP server's stdout is the JSON-RPC channel — one console.log drops
  // the connection. Error severity, console.error only.
  mcpStdio(['packages/design-system-mcp/**/*.mjs']),
  {
    // CLI entry points whose stdout *is* the product: the scaffolder's prompts,
    // and the repo scripts that report what they changed. Anywhere else a
    // console.log is debug residue, which is what the base rule catches.
    files: [
      'packages/create-elirobinson-design-system/src/cli.mjs',
      'packages/react/scripts/**/*.mjs',
      'packages/ai-elements/scripts/**/*.mjs',
      'scripts/**/*.mjs',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  // Playwright names a fixture's teardown callback `use`, and React 19 has a
  // hook of the same name — so rules-of-hooks reads `await use(page)` as a hook
  // called outside a component. There is no React in this directory at all; the
  // react plugins are applied repo-wide above and simply over-reach here.
  {
    files: ['tests/visual/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  // We publish these rules; we hold ourselves to them. The component library is
  // the one place `@elirobinson/react` may be authored without importing itself,
  // so only the hardcoded-values half applies here.
  ...designSystem({ gapFiller: [] }).map((entry) => ({
    ...entry,
    files: ['packages/react/src/**/*.{ts,tsx}'],
    rules: {
      '@elirobinson/no-hardcoded-design-values':
        entry.rules['@elirobinson/no-hardcoded-design-values'],
    },
  })),
  // The one rule that IS pointed at the vendored tree, and the reason
  // VENDORED_ELEMENTS is a per-config ignore rather than a global one.
  //
  // `@elirobinson/tokens/tailwind.css` is what makes AI Elements render in
  // Miltinson colours with no edits to its source: it maps Tailwind's whole
  // colour namespace onto the tokens, `@theme inline`, so every utility the
  // components already use compiles to `var(--token)` and answers to all three
  // dials. The one thing that defeats it is a literal — `text-zinc-500`,
  // `bg-red-100 dark:bg-red-900/30`, `bg-[#71717b]` — because no alias can
  // re-point Tailwind's own palette. `scripts/ai-elements-patches/skin.mjs`
  // rewrites the ones the pinned release ships; this is what stops the next
  // bump from quietly putting one back.
  //
  // Only this rule, and it has no fixer, so `eslint . --fix` still writes
  // nothing here and the sync check keeps its "every difference is
  // attributable" property.
  //
  // The `allow` list is the pressure valve for upstream churn, and it is kept
  // as close to empty as the tree allows — an entry is a literal we have agreed
  // to live with, so each one carries its reason. It is NOT the place to park a
  // colour: a literal colour has a token behind it by definition, and the fix
  // is a line in skin.mjs.
  {
    name: '@elirobinson/design-system/vendored-elements',
    files: ['packages/ai-elements/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@elirobinson': designSystemPlugin },
    rules: {
      '@elirobinson/no-hardcoded-design-values': [
        'error',
        {
          allow: [
            // speech-input's listening rings: three concentric `animate-ping`s
            // on a 2s loop, offset 0.3s apart. The motion ramp is a UI
            // transition ramp — 80ms to 420ms — and deliberately has no step
            // for an ambient loop an order of magnitude longer, so there is no
            // token to point this at. Mapping it to `--dur-slow` would be a
            // fifth of the intended period, which is a different animation.
            '2s',
          ],
        },
      ],
    },
  },
  // Same bargain for the copy rule, and it reaches the docs site too: the
  // component library ships default strings, and the docs app renders chrome
  // around its editorial prose. We publish this at `warn` so an upgrade cannot
  // break a consumer's build; here it is an error, because there is no
  // pre-existing copy to work through.
  ...designSystem({ gapFiller: [], copy: { severity: 'error' } }).map((entry) => ({
    ...entry,
    files: ['packages/react/src/**/*.{ts,tsx}', 'apps/docs/src/**/*.{ts,tsx}'],
    rules: {
      '@elirobinson/no-padded-ui-copy': entry.rules['@elirobinson/no-padded-ui-copy'],
    },
  })),
  prettierConfig,
);
