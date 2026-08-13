// The plugin object, exported separately so a consumer with an unusual setup
// can register the rules themselves instead of taking the whole config.

import noHardcodedDesignValues from './rules/no-hardcoded-design-values.mjs';
import noPaddedUiCopy from './rules/no-padded-ui-copy.mjs';

export const plugin = {
  meta: { name: '@elirobinson/eslint-config', version: '0.1.0' },
  rules: {
    'no-hardcoded-design-values': noHardcodedDesignValues,
    'no-padded-ui-copy': noPaddedUiCopy,
  },
};

export default plugin;
