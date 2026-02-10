import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNative from 'eslint-plugin-react-native';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // =========================================================================
  // Global ignores (replaces ignorePatterns)
  // =========================================================================
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'playwright-report/',
      'test-results/',
      '.expo/',
      '*.config.js',
      '*.config.mjs',
      'web/',
      'scripts/',
    ],
  },

  // =========================================================================
  // Base configs
  // =========================================================================
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,

  // =========================================================================
  // Main config for all TS/TSX files
  // =========================================================================
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-native': reactNative,
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',

      // Detect unused private class members
      'no-unused-private-class-members': 'warn',

      // React
      'react/prop-types': 'off',

      // React Hooks
      'react-hooks/static-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',

      // React Native — enable useful rules, disable noisy ones
      'react-native/no-raw-text': 'error',
      'react-native/split-platform-components': 'error',
      'react-native/no-single-element-style-arrays': 'warn',
      'react-native/no-inline-styles': 'off',
      'react-native/sort-styles': 'off',
      'react-native/no-unused-styles': 'off',
      'react-native/no-color-literals': 'off',

      // Import sorting
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
    },
  },

  // =========================================================================
  // Test file overrides
  // =========================================================================
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', 'jest.setup.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // =========================================================================
  // Metro require() — assets must use require() for bundler
  // =========================================================================
  {
    files: [
      'src/services/infra/AudioService.ts',
      'src/utils/avatar.ts',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // =========================================================================
  // E2E (Playwright) — not React components, disable hooks rules
  // =========================================================================
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
);
