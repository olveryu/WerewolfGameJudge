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
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended', 'plugin:storybook/recommended'],
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
    // Disable some rules that are too strict
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'off', // Expo assets require require()
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript
    '@typescript-eslint/no-empty-object-type': 'off',
    'react-hooks/static-components': 'off', // Allow inline components for simple cases
  // This repo isn't using React Compiler as a hard gate; these rules are too noisy and
  // flag common state-sync patterns that are acceptable for this app.
  'react-hooks/set-state-in-effect': 'off',
  'react-hooks/preserve-manual-memoization': 'off',
  },
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
