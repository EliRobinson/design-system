// The same no-hardcoded-design-values contract, applied to stylesheets.
//
// Kept in its own entry point because it needs @eslint/css, which registers a
// second ESLint language. Importing '@elirobinson/eslint-config' never loads
// this, so consumers who only lint JS/TSX pay nothing for it.
//
//   // eslint.config.mjs
//   import designSystem from '@elirobinson/eslint-config'
//   import designSystemCss from '@elirobinson/eslint-config/css'
//   export default [...designSystem(), ...designSystemCss()]
//
// Point it away from any stylesheet that legitimately *defines* values — a
// token file, or a vendored third-party sheet — via `ignores`.

import css from '@eslint/css';

import { cssRule } from './rules/no-hardcoded-css-values.mjs';

export const plugin = {
  meta: { name: '@elirobinson/eslint-config/css' },
  rules: { 'no-hardcoded-design-values': cssRule },
};

/**
 * @param {object} [options]
 * @param {string[]} [options.files]
 * @param {string[]} [options.ignores] stylesheets that define values rather
 *   than consume them (your own token layer, vendored CSS)
 * @param {'error' | 'warn'} [options.severity]
 * @returns {import('eslint').Linter.Config[]}
 */
export function designSystemCss(options = {}) {
  const { files = ['**/*.css'], ignores = [], severity = 'error' } = options;

  return [
    {
      name: '@elirobinson/design-system/css',
      files,
      ignores,
      language: 'css/css',
      plugins: { css, '@elirobinson-css': plugin },
      rules: {
        '@elirobinson-css/no-hardcoded-design-values': severity,
      },
    },
  ];
}

export default designSystemCss;
