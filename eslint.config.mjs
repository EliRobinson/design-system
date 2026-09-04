import designSystem, { mcpStdio } from '@elirobinson/eslint-config';
import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

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
      // Vendored verbatim from vercel/ai-elements. Every file here is written
      // by `pnpm sync:elements` from the pinned upstream release, so a lint fix
      // applied to one is reverted by the next bump — and until then it reads
      // as local divergence and makes that bump fail as a conflict, which is
      // the whole point of the sync check. Our own rules apply to code we can
      // actually change: the package's scripts/ and types/ are NOT ignored.
      // (Measured at ai-elements@1.9.0: 3 no-unused-vars errors, all on
      // deliberate `_`-prefixed discards upstream keeps for documentation.)
      'packages/ai-elements/src/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
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
