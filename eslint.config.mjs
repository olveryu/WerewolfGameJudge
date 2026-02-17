import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNative from 'eslint-plugin-react-native';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import testingLibrary from 'eslint-plugin-testing-library';
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
      '**/*.config.js',
      '**/*.config.mjs',
      'web/',
      'scripts/',
      'supabase/',
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
      ecmaVersion: 'latest',
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

      // Console — use project logger (src/utils/logger.ts) instead
      'no-console': 'error',

      // Import sorting
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
    },
  },

  // =========================================================================
  // Test file overrides
  // =========================================================================
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    plugins: {
      'testing-library': testingLibrary,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',

      // testing-library best practices
      'testing-library/await-async-queries': 'error',
      'testing-library/no-await-sync-queries': 'error',
      'testing-library/no-debugging-utils': 'warn',
      'testing-library/no-unnecessary-act': 'warn',
      'testing-library/prefer-screen-queries': 'off',
    },
  },

  // =========================================================================
  // jest.setup.ts — needs console.* for React warning filters
  // =========================================================================
  {
    files: ['jest.setup.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // =========================================================================
  // Metro require() — assets must use require() for bundler
  // =========================================================================
  {
    files: ['src/services/infra/AudioService.ts', 'src/utils/avatar.ts'],
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

  // =========================================================================
  // E2E diagnostics helper — forwards browser console for debugging
  // =========================================================================
  {
    files: ['e2e/helpers/diagnostics.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // =========================================================================
  // Mocks — allow require() and console
  // =========================================================================
  {
    files: ['__mocks__/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // =========================================================================
  // Animation components — Animated.Value mutations are expected in RN
  // react-hooks/immutability: `.value = x` on shared values / Animated.Value
  // react-hooks/refs: `useRef(new Animated.Value()).current` is standard RN pattern
  // =========================================================================
  {
    files: [
      'src/components/RoleRevealEffects/**/*.tsx',
      'src/components/AIChatBubble/**/*.tsx',
      'src/components/AIChatBubble/**/*.ts',
    ],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
);
