import { dirname } from 'node:path';
import { createRequire } from 'node:module';

import type { StorybookConfig } from '@storybook/react-vite';

const packageResolver = createRequire(process.cwd() + '/package.json');

const config: StorybookConfig = {
  stories: [
    '../src/app/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    '../src/docs/**/*.mdx',
    '../../../packages/core/src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../../../packages/audio-worklet/src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../../../packages/interpolation-strategy-linear/src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../../../packages/interpolation-strategy-lanczos/src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
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
