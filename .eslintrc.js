module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native', 'simple-import-sort'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-native/all',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // Detect unused private class members (methods, properties)
    'no-unused-private-class-members': 'warn',
    '@typescript-eslint/no-require-imports': 'warn', // Targeted inline-disable where Expo require() is needed
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript
    '@typescript-eslint/no-empty-object-type': 'off',
    'react-hooks/static-components': 'off', // Allow inline components for simple cases
    // This repo isn't using React Compiler as a hard gate; these rules are too noisy and
    // flag common state-sync patterns that are acceptable for this app.
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-native/no-inline-styles': 'off', // Inline styles are used extensively in this project
    'react-native/sort-styles': 'off', // Too strict for this codebase
    'react-native/no-unused-styles': 'off', // False positives with createStyles() factory pattern
    'react-native/no-color-literals': 'off', // Theme-driven; color literals are acceptable in style factories
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
  },
  overrides: [
    {
      // Tests frequently use require() for lazy imports after jest.mock()
      files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'playwright-report/',
    'test-results/',
    '.expo/',
    '*.config.js',
  ],
};
