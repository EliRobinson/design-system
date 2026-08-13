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
      // design-sync (claude.ai/design) scratch: the staged converter, its
      // generated preview wrappers, the reference storybook build, and the
      // emitted bundle. All gitignored and regenerated on every sync.
      // .design-sync/gen-entry.mjs is committed and stays linted.
      '.design-sync/.cache/**',
      '.design-sync/sb-reference/**',
      '.ds-sync/**',
      'ds-bundle/**',
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
      'scripts/**/*.mjs',
    ],
    rules: {
      'no-console': 'off',
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
