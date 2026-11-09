import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
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
      '.venv/',
      '**/dist/',
      '**/.wrangler/',
      'build/',
      'playwright-report/',
      'test-results/',
      '**/*.config.js',
      '**/*.config.mjs',
      'miniapp/',
      'scripts/',
      'functions/',
      '**/worker-configuration.d.ts',
    ],
  },

  // =========================================================================
  // Base configs
  // =========================================================================
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,

  // Global React settings (must be top-level so react plugin picks it up)
  { settings: { react: { version: 'detect' } } },

  // =========================================================================
  // Main config for all TS/TSX files
  // =========================================================================
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
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
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // TypeScript — base
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',

      // TypeScript — type-checked: keep high-value async/promise rules
      // no-floating-promises, no-misused-promises, await-thenable enabled by recommendedTypeChecked
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',

      // Enforce `import type` for type-only imports (required by verbatimModuleSyntax)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],

      // TypeScript — type-checked: no-unsafe-* family
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/restrict-template-expressions': 'off',

      // Detect unused private class members
      'no-unused-private-class-members': 'warn',

      // React
      'react/prop-types': 'off',

      // React Compiler rules (eslint-plugin-react-hooks flat recommended) stay on: the web client
      // compiles every component, so a violation is a miscompile risk, not a style nit.

      // Console — use the package logger (packages/web/src/utils/logger.ts) instead
      'no-console': 'error',

      // Deprecated identifiers — prevent regression after bulk renames
      'no-restricted-syntax': [
        'error',
        { selector: "Identifier[name='roomNumber']", message: "Renamed → 'roomCode'" },
        { selector: "Identifier[name='seatNumber']", message: "Renamed → 'seat'" },
        { selector: "Identifier[name='hostId']", message: "Renamed → 'hostUserId'" },
        { selector: "Identifier[name='pityTriggered']", message: "Renamed → 'isPityTriggered'" },
        {
          selector: "Identifier[name='uid']",
          message: "Renamed → 'userId' (or 'id' for User entity)",
        },
      ],

      // Import sorting
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'warn',
        // Default: camelCase, no leading underscore
        { selector: 'default', format: ['camelCase'] },
        // Variables: allow _prefix for exhaustive checks / destructuring placeholders
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        // Functions: camelCase | PascalCase (React components)
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        // Parameters: allow _prefix for unused callback params
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        // Class / interface / type alias / enum: PascalCase
        { selector: 'typeLike', format: ['PascalCase'] },
        // Enum members: PascalCase | UPPER_CASE
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
        // Object literal properties & methods: relax (external APIs, JSON keys, mock components)
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'objectLiteralMethod', format: null },
        { selector: 'typeProperty', format: null },
        // Import: allow any (third-party naming out of our control)
        { selector: 'import', format: null },
      ],
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
      // vi.fn() results trigger false positives for unbound-method
      '@typescript-eslint/unbound-method': 'off',

      // testing-library best practices
      'testing-library/await-async-queries': 'error',
      'testing-library/no-await-sync-queries': 'error',
      'testing-library/no-debugging-utils': 'warn',
      'testing-library/no-unnecessary-act': 'warn',
      'testing-library/prefer-screen-queries': 'off',
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
  // JS files — disable type-checked rules (no tsconfig coverage)
  // =========================================================================
  {
    files: ['**/*.{js,mjs,mts,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // =========================================================================
  // Cloudflare Workers (api-worker) — Workers runtime, no React
  // =========================================================================
  {
    files: ['packages/api-worker/**/*.ts'],
    rules: {
      // Workers must use structured logger — only lib/logger.ts may call console directly
      'no-console': 'error',
      // Disable React rules — no UI framework in Workers
      'react/no-unknown-property': 'off',
      '@typescript-eslint/naming-convention': 'off',
    },
  },
  // api-worker tests: use tsconfig.test.json so `cloudflare:test` types resolve.
  // projectService doesn't discover non-standard tsconfig filenames;
  // explicit `project` is required per typescript-eslint docs.
  {
    files: ['packages/api-worker/src/**/__tests__/**/*.ts', 'packages/api-worker/test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './packages/api-worker/tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Allow console.* only in the Worker logger abstraction
  {
    files: ['packages/api-worker/src/platform/observability/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // =========================================================================
  // Web client (packages/web) — React DOM
  // =========================================================================
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    rules: {
      // Untrusted strings render only through React's default escaping (docs/web-client-rewrite.md §5.11).
      'react/no-danger': 'error',
    },
  },
  // The web client's logger is the only place allowed to write to the console.
  {
    files: ['packages/web/src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
