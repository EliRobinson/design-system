// The two linters every config test runs through: the JS config on a .jsx
// file and the CSS config on a .css file, each with the options under test.

import { Linter } from 'eslint';

import { designSystemCss } from './css.mjs';
import { designSystem } from './index.mjs';

const linter = new Linter();

export function lint(code, { filename = 'src/app/page.jsx', options } = {}) {
  const config = [
    {
      files: ['**/*.{js,jsx}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    ...designSystem(options),
  ];

  return linter.verify(code, config, filename);
}

export function lintCss(code, { filename = 'src/app/app.css', options } = {}) {
  return linter.verify(code, designSystemCss(options), filename);
}

export const messagesOf = (results) => results.map((result) => result.message);
export const rulesOf = (results) => results.map((result) => result.ruleId);
