/**
 * The UI gate's ESLint configuration (UI drift lock plan v3, §3). `gate.mjs` runs it on the
 * bundle graph's scripts with `overrideConfigFile: true` and `allowInlineConfig: false`, so the
 * repository's `eslint.config.mjs` (its ignores and overrides) and `eslint-disable` comments do
 * not apply to the gate. Rules the main configuration also runs are enabled here again for the
 * same reason (E9, E11).
 */
import tseslint from 'typescript-eslint';

import uiPlugin from './eslint-plugin.mjs';
import { REACT_DOM_CLIENT_IMPORTS } from './registry.mjs';

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
      plugins: { ui: uiPlugin, '@typescript-eslint': tseslint.plugin },
      rules: {
        'ui/dom-allowlist': 'error',
        'ui/element-allowlist': 'error',
        'ui/inline-style-keys': 'error',
        'ui/package-adapter': 'error',
        'no-eval': 'error',
        'no-new-func': 'error',
        '@typescript-eslint/no-implied-eval': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'error',
        '@typescript-eslint/no-unsafe-call': 'error',
        '@typescript-eslint/no-unsafe-argument': 'error',
        '@typescript-eslint/no-unsafe-assignment': 'error',
        // Which package specifiers may be imported at all is the bundle graph's (`PACKAGES`
        // entries), and by which module `ui/package-adapter`'s; this keeps the one named import
        // of the one React DOM entry.
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react-dom/client',
                allowImportNames: [...REACT_DOM_CLIENT_IMPORTS],
                message: REACT_DOM_MESSAGE,
              },
            ],
          },
        ],
      },
    },
  ];
}
