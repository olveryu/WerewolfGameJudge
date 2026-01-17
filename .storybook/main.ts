import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [],
  framework: '@storybook/react-vite',
  viteFinal: async (config) => {
    return mergeConfig(config, {
      esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react',
      },
      resolve: {
        alias: {
          'react-native': 'react-native-web',
          // Mock avatar module - match all possible import paths
          '@/utils/avatar': resolve(__dirname, './mocks/avatar.ts'),
          '../utils/avatar': resolve(__dirname, './mocks/avatar.ts'),
          '../../utils/avatar': resolve(__dirname, './mocks/avatar.ts'),
          '../../../utils/avatar': resolve(__dirname, './mocks/avatar.ts'),
          // Use absolute path matching for the actual file
          [resolve(__dirname, '../src/utils/avatar.ts')]: resolve(__dirname, './mocks/avatar.ts'),
          [resolve(__dirname, '../src/utils/avatar')]: resolve(__dirname, './mocks/avatar.ts'),
          // Mock alert module
          '@/utils/alert': resolve(__dirname, './mocks/alert.ts'),
          '../utils/alert': resolve(__dirname, './mocks/alert.ts'),
          '../../utils/alert': resolve(__dirname, './mocks/alert.ts'),
          '../../../utils/alert': resolve(__dirname, './mocks/alert.ts'),
        },
      },
      define: {
        // Required for some RN packages
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        __DEV__: true,
      },
    });
  },
};
export default config;
