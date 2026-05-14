import { dirname } from 'node:path';
import { createRequire } from 'node:module';

import type { StorybookConfig } from '@storybook/react-vite';

const packageResolver = createRequire(process.cwd() + '/package.json');

const config: StorybookConfig = {
  stories: [
    '../src/stories/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    '../src/app/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    '../src/docs/**/*.mdx',
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {
      builder: {
        viteConfigPath: 'storybook/vite.config.mts',
      },
    },
  },
  addons: [getAbsolutePath('@storybook/addon-docs')],
};

function getAbsolutePath(value: string): string {
  return dirname(packageResolver.resolve(`${value}/package.json`));
}

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
