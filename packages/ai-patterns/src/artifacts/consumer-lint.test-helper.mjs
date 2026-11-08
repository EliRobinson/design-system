/* A stand-in for a typical consumer's ESLint over the UI kit samples (#119):
 * the recommended rules, plus eslint-plugin-react's jsx-no-undef and jsx-uses-vars
 * over .jsx.
 *
 * Shared by ui-kits-lint.test.mjs, which lints the kits in this repo, and by
 * scripts/tarball-consumer/checks.mjs, which lints what `ds-resync artifacts
 * --write` puts in a scratch app from the packed tarball. One config, so both
 * hold the kits to the same rules. The plugins are passed in because the
 * scratch-app check loads them from the app's node_modules, not this repo's.
 *
 * `.test-helper.mjs`: never collected as a test, and never published.
 */
export function consumerLintConfig({ js, react }) {
  return [
    js.configs.recommended,
    /* An unused directive is an error too. Adding a blanket header to a kit
       that does not need one would trip this, which is why only the kits that
       actually reference the shared primitives carry one. */
    { linterOptions: { reportUnusedDisableDirectives: 'error' } },
    {
      files: ['**/*.jsx'],
      plugins: { react },
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      settings: { react: { version: '18.3.1' } },
      /* jsx-uses-vars too: without it core no-unused-vars counts no JSX tag as a
         use, so every React file that imports a component fails, kit or not. It is
         in eslint-plugin-react's recommended set, the config a consumer who loads
         the plugin for JSX has. The kits name the real components they render as
         locals, read from window.DesignSystem (#321). */
      rules: { 'react/jsx-no-undef': 'error', 'react/jsx-uses-vars': 'error' },
    },
  ];
}
