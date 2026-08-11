// The statically checkable half of @elirobinson/ai-patterns' contracts.json,
// as a flat ESLint config. Every rule here corresponds to a constraint that
// names it in its `verifiedBy` field, so a reader of the contracts can tell
// which ones are automated.
//
//   // eslint.config.mjs
//   import designSystem from '@elirobinson/eslint-config'
//   export default [...designSystem(), /* your own config */]
//
// The contracts a browser has to settle — touch targets, visible focus,
// contrast — are not lintable. They ship as Playwright helpers in
// @elirobinson/ai-patterns/testing/playwright.

import { plugin } from './plugin.mjs';

/** contracts.json → no-barrel-imports */
const BARREL_SPECIFIERS = [
  '@elirobinson/react',
  '@elirobinson/tokens',
  '@elirobinson/ai-patterns',
].map((name) => ({
  name,
  message: `${name} has no barrel export — import a subpath instead. Run \`pnpm ds props <Name>\` for the exact import line.`,
}));

/** One component vocabulary, not two. */
const FOREIGN_UI_LIBRARIES = {
  group: [
    '@mui/*',
    '@material-ui/*',
    '@chakra-ui/*',
    '@mantine/*',
    '@nextui-org/*',
    '@heroui/*',
    'antd',
    'antd/*',
    'react-bootstrap',
    'react-bootstrap/*',
    '@headlessui/*',
    'daisyui',
  ],
  message:
    'Use @elirobinson/react instead — run `pnpm ds` for the inventory. If the system is genuinely missing the component, compose it from primitives or flag it for upstreaming.',
};

/** The system already wraps these; importing them directly forks its behaviour. */
const DIRECT_PRIMITIVES = {
  group: ['@radix-ui/*', 'radix-ui', 'radix-ui/*'],
  message:
    'The design system already wraps these primitives — import from @elirobinson/react instead (run `pnpm ds` for the subpaths).',
};

const SOURCE_FILES = ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'];

/**
 * @param {object} [options]
 * @param {string[]} [options.gapFiller] globs where a sanctioned gap-filler
 *   lives (shadcn/ui output, typically). Direct primitive imports are allowed
 *   there; every other ban still applies.
 * @param {string[]} [options.files] override which files the config applies to
 * @param {'error' | 'warn'} [options.severity]
 * @param {object} [options.hardcodedValues] options for no-hardcoded-design-values
 * @returns {import('eslint').Linter.Config[]}
 */
export function designSystem(options = {}) {
  const {
    gapFiller = ['**/components/ui/**'],
    files = SOURCE_FILES,
    severity = 'error',
    hardcodedValues = {},
  } = options;

  const restrictedImports = (patterns) => [severity, { paths: BARREL_SPECIFIERS, patterns }];

  const config = [
    {
      name: '@elirobinson/design-system',
      files,
      plugins: { '@elirobinson': plugin },
      rules: {
        'no-restricted-imports': restrictedImports([FOREIGN_UI_LIBRARIES, DIRECT_PRIMITIVES]),
        '@elirobinson/no-hardcoded-design-values': [severity, hardcodedValues],
      },
    },
  ];

  if (gapFiller.length) {
    config.push({
      name: '@elirobinson/design-system/gap-filler',
      files: gapFiller,
      rules: {
        // Generated shadcn/ui components are built on primitives directly.
        // They are the sanctioned gap-filler, so only the foreign-library and
        // barrel bans apply here.
        'no-restricted-imports': restrictedImports([FOREIGN_UI_LIBRARIES]),
      },
    });
  }

  return config;
}

export { plugin };
export default designSystem;
