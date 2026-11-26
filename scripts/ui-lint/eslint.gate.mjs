/**
 * The UI gate's ESLint configuration (UI drift lock plan v3, §3). `gate.mjs` runs it on the
 * bundle graph's scripts with `overrideConfigFile: true` and `allowInlineConfig: false`, so the
 * repository's `eslint.config.mjs` (its ignores and overrides) and `eslint-disable` comments do
 * not apply to the gate. Rules the main configuration also runs are enabled here again for the
 * same reason (E9, E11).
 */
import path from 'node:path';

import reactPlugin from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

import uiPlugin from './eslint-plugin.mjs';

const REACT_DOM_MESSAGE =
  'Only createRoot from react-dom/client: React DOM resource APIs insert <link>/<script> past the gate (UI gate E11).';

export function gateConfig(repoRoot) {
  return [
    {
      files: ['**/*.{ts,tsx}'],
      linterOptions: { reportUnusedDisableDirectives: 'off' },
      languageOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: {
          projectService: true,
          tsconfigRootDir: repoRoot,
          ecmaFeatures: { jsx: true },
        },
      },
      plugins: { ui: uiPlugin, react: reactPlugin, '@typescript-eslint': tseslint.plugin },
      rules: {
        'ui/dom-allowlist': 'error',
        'ui/element-allowlist': 'error',
        'ui/inline-style-keys': 'error',
        'react/no-danger': 'error',
        'no-eval': 'error',
        'no-new-func': 'error',
        '@typescript-eslint/no-implied-eval': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'error',
        '@typescript-eslint/no-unsafe-call': 'error',
        '@typescript-eslint/no-unsafe-argument': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'error',
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react-dom/client',
                allowImportNames: ['createRoot'],
                message: REACT_DOM_MESSAGE,
              },
              { name: 'react-dom', message: REACT_DOM_MESSAGE },
              {
                name: 'react/jsx-runtime',
                message: 'JSX goes through the compiler (UI gate E11).',
              },
              {
                name: 'react/jsx-dev-runtime',
                message: 'JSX goes through the compiler (UI gate E11).',
              },
            ],
            patterns: [{ group: ['react-dom/*', '!react-dom/client'], message: REACT_DOM_MESSAGE }],
          },
        ],
      },
    },
  ];
}

/** For `eslint --config scripts/ui-lint/eslint.gate.mjs` (the generator test). */
export default gateConfig(path.resolve(import.meta.dirname, '../..'));
