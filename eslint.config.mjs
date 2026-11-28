import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Deprecated identifiers — prevent regression after bulk renames. */
const RENAMED_IDENTIFIER_SELECTORS = [
  { selector: "Identifier[name='roomNumber']", message: "Renamed → 'roomCode'" },
  { selector: "Identifier[name='seatNumber']", message: "Renamed → 'seat'" },
  { selector: "Identifier[name='hostId']", message: "Renamed → 'hostUserId'" },
  { selector: "Identifier[name='pityTriggered']", message: "Renamed → 'isPityTriggered'" },
  {
    selector: "Identifier[name='uid']",
    message: "Renamed → 'userId' (or 'id' for User entity)",
  },
];

const TEST_ID_ONLY_MESSAGE =
  'E2E locates elements only through getByTestId(TESTIDS.x); assert visible copy on the located element.';

/** E2E locators: test ids from the TESTIDS registry only. */
const E2E_LOCATOR_SELECTORS = [
  {
    selector:
      'CallExpression[callee.property.name=/^getBy(Text|Role|Label|Placeholder|AltText|Title)$/]',
    message: TEST_ID_ONLY_MESSAGE,
  },
  { selector: "CallExpression[callee.property.name='locator']", message: TEST_ID_ONLY_MESSAGE },
  {
    selector: "CallExpression[callee.property.name='getByTestId'][arguments.0.type='Literal']",
    message: TEST_ID_ONLY_MESSAGE,
  },
  {
    selector:
      "CallExpression[callee.property.name='getByTestId'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0]",
    message: TEST_ID_ONLY_MESSAGE,
  },
];

// =========================================================================
// UI drift lock (docs/ui-drift-lock plan §3): community rules only, existing problems recorded
// in eslint-suppressions.json (ESLint bulk suppressions).
// =========================================================================

const INLINE_STYLE_MESSAGE =
  "Inline styles carry only custom properties ('--name'); write the declaration in the component stylesheet with theme tokens.";
const DOM_STYLE_MESSAGE =
  'Script sets only custom properties (style.setProperty with a --name); write the declaration in the stylesheet.';

/** Style writes outside the stylesheets: what reaches the page without passing Stylelint. */
const UI_STYLE_SELECTORS = [
  {
    selector:
      "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property:not([key.value=/^--/])",
    message: INLINE_STYLE_MESSAGE,
  },
  {
    selector:
      "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > SpreadElement",
    message: INLINE_STYLE_MESSAGE,
  },
  {
    selector:
      "JSXAttribute[name.name='style'] > JSXExpressionContainer > :not(ObjectExpression, JSXEmptyExpression)",
    message: `${INLINE_STYLE_MESSAGE} The value is an object literal written in place.`,
  },
  {
    selector: "AssignmentExpression > MemberExpression.left[object.property.name='style']",
    message: DOM_STYLE_MESSAGE,
  },
  {
    selector: "AssignmentExpression > MemberExpression.left[property.name='style']",
    message: DOM_STYLE_MESSAGE,
  },
  {
    selector:
      "CallExpression[callee.object.property.name='style'][callee.property.name='setProperty']:not([arguments.0.value=/^--/]):not([arguments.0.quasis.0.value.raw=/^--/])",
    message: DOM_STYLE_MESSAGE,
  },
  {
    selector: "CallExpression[callee.property.name='setAttribute'][arguments.0.value='style']",
    message: DOM_STYLE_MESSAGE,
  },
];

/** The avatar's shape has one source (config/avatarShape.ts); see plan §3 P9. */
const AVATAR_RATIO_SELECTORS = [
  {
    selector:
      "Literal[value=/--avatar-corner-ratio/], TemplateElement[value.raw=/--avatar-corner-ratio/], Identifier[name='AVATAR_CORNER_RATIO_PROPERTY']",
    message: 'Only config/avatarShape.ts publishes the avatar corner ratio.',
  },
];
const AVATAR_DRAWING_SELECTORS = [
  {
    selector:
      'JSXOpeningElement[name.name=/^[a-z]/] > JSXAttribute[name.name=/^(src|srcSet|href|xlinkHref|poster)$/] Identifier[name=/avatarUrl/i]',
    message: 'Avatars reach the page only through <Avatar>.',
  },
  {
    selector:
      "JSXAttribute[name.name=/^data-(framed|tile-border)$/] > JSXExpressionContainer:not(:has(CallExpression[callee.name='wearsFrame']))",
    message: 'Whether a tile wears a frame is read through wearsFrame().',
  },
];

/**
 * Packages that write the page from values we hand them, each reachable only through its
 * adapter module (`null`: no adapter yet, every import is recorded debt).
 */
const PACKAGE_ADAPTERS = {
  '@ark-ui/react/color-picker': 'packages/web/src/features/drawing/components/DrawingToolbar.tsx',
  '@ark-ui/react/dialog': 'packages/web/src/components/AppDialog.tsx',
  '@ark-ui/react/portal': null,
  '@ark-ui/react/qr-code': 'packages/web/src/features/room/components/RoomShareDialog.tsx',
  '@ark-ui/react/tabs': null,
  '@sentry/react': null,
  '@sentry/react/react-router': null,
  '@zumer/snapdom': 'packages/web/src/features/room/services/captureElementPng.ts',
  'pixi.js': null,
  'pixi.js/browser': null,
  'pixi.js/unsafe-eval': null,
  sonner: null,
};
const AVATAR_MODULES = [
  'packages/web/src/components/avatar/**',
  'packages/web/src/games/*/assets/roleAvatars.ts',
];

/** `no-restricted-imports` for a web file, letting through its own adapted package. */
function restrictedImports({ adapted = null, avatarModule = false } = {}) {
  return [
    'error',
    {
      paths: [
        ...Object.entries(PACKAGE_ADAPTERS)
          .filter(([name]) => name !== adapted)
          .map(([name, adapter]) => ({
            name,
            message: adapter
              ? `Import ${name} only in ${adapter}; use what it exports.`
              : `${name} has no adapter module yet; add one and import it there.`,
          })),
        {
          name: 'react-dom/client',
          allowImportNames: ['createRoot'],
          message: 'Only createRoot: React DOM resource APIs insert <link>/<script> into the page.',
        },
      ],
      patterns: [
        {
          // A shared component's sheet belongs to that component: render the component instead of
          // borrowing its skin. The two surface sheets have no component; they are the skin.
          group: [
            '@/components/**/*.css',
            '!@/components/PaperboardPanel.css',
            '!@/components/HeaderSurface.css',
          ],
          message: "A component's stylesheet is styled through that component; render it instead.",
        },
        ...(avatarModule
          ? []
          : [
              {
                group: ['**/assets/avatars/**'],
                message: 'Avatars reach the page only through <Avatar>.',
              },
              {
                group: ['**/avatar/avatarSources'],
                importNames: [
                  'getHandDrawnPortraitUrl',
                  'resolveAvatarSource',
                  'HAND_DRAWN_PORTRAITS',
                ],
                message: 'Avatars reach the page only through <Avatar>.',
              },
            ]),
      ],
    },
  ];
}

const WEB_PRODUCTION = {
  files: ['packages/web/{src,preview}/**/*.{ts,tsx}'],
  ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
};

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
      'no-restricted-syntax': ['error', ...RENAMED_IDENTIFIER_SELECTORS],

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
      'no-restricted-syntax': ['error', ...RENAMED_IDENTIFIER_SELECTORS, ...E2E_LOCATOR_SELECTORS],
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

  // Standalone browser prototypes are not covered by the TypeScript web config.
  {
    files: ['mockups/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
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
  // UI drift lock: design values live in stylesheets (Stylelint), components own their elements.
  {
    ...WEB_PRODUCTION,
    rules: {
      'no-restricted-syntax': [
        'error',
        ...RENAMED_IDENTIFIER_SELECTORS,
        ...UI_STYLE_SELECTORS,
        ...AVATAR_RATIO_SELECTORS,
        ...AVATAR_DRAWING_SELECTORS,
      ],
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            CSSProperties: INLINE_STYLE_MESSAGE,
            'React.CSSProperties': INLINE_STYLE_MESSAGE,
          },
        },
      ],
      'react/jsx-props-no-spreading': [
        'error',
        { html: 'enforce', custom: 'ignore', explicitSpread: 'ignore' },
      ],
      'no-restricted-imports': restrictedImports(),
    },
  },
  ...Object.entries(PACKAGE_ADAPTERS)
    .filter(([, adapter]) => adapter !== null)
    .map(([name, adapter]) => ({
      files: [adapter],
      rules: { 'no-restricted-imports': restrictedImports({ adapted: name }) },
    })),
  {
    files: AVATAR_MODULES,
    ignores: WEB_PRODUCTION.ignores,
    rules: { 'no-restricted-imports': restrictedImports({ avatarModule: true }) },
  },
  {
    files: ['packages/web/src/config/avatarShape.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...RENAMED_IDENTIFIER_SELECTORS,
        ...UI_STYLE_SELECTORS,
        ...AVATAR_DRAWING_SELECTORS,
      ],
    },
  },
  {
    files: ['packages/web/src/components/avatar/**'],
    ignores: WEB_PRODUCTION.ignores,
    rules: {
      'no-restricted-syntax': [
        'error',
        ...RENAMED_IDENTIFIER_SELECTORS,
        ...UI_STYLE_SELECTORS,
        ...AVATAR_RATIO_SELECTORS,
      ],
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
