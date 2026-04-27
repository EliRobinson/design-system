import type { StorybookConfig } from '@storybook/react-vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  viteFinal: async (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@design-system/react': resolve(currentDirectory, '../../../packages/react/src'),
      '@design-system/tokens': resolve(currentDirectory, '../../../packages/tokens/src'),
    };
    return config;
  },
};

export default config;
