/**
 * What the UI gate covers, defined once: `stylelint.config.mjs`, `eslint.config.mjs`,
 * `styleGate.mjs` and the baseline ratchet all read these constants (P1 QA3 H7). The gate covers
 * everything Vite can put on the page: the web package and the engine source the web build
 * compiles in (`packages/web/vite.config.ts` aliases `@game-judge/game-engine/*` to it).
 */

export const WEB_PACKAGE = 'packages/web';
export const WEB_SOURCE = 'packages/web/src';

/**
 * Whether a repo-relative path (symbolic links resolved) is a stylesheet the CSS gate lints: the
 * gate lints every tracked `.css` in the web package (`styleGate.mjs`), and nothing installed.
 * Both `ui/import-scope` rules (CSS `@import`, TS stylesheet imports) use this one test.
 */
export function inCssGate(file) {
  return file.startsWith(`${WEB_PACKAGE}/`) && !/(?:^|\/)node_modules\//.test(file);
}

/** Source trees bundled into the page. */
export const BUNDLED_SOURCE_ROOTS = Object.freeze([WEB_SOURCE, 'packages/game-engine/src']);

/** Any script a bundler or Node would load. */
export const SCRIPT_FILE = /\.[cm]?[jt]sx?$/i;
/** The only scripts allowed in bundled source: TypeScript, which the ESLint gate checks. */
export const BUNDLED_SCRIPT = /\.tsx?$/;

/** Files the ESLint UI gate rules apply to: bundled source and the web package's build code. */
export const UI_GATE_SCRIPT_GLOBS = Object.freeze([
  'packages/web/**/*.{ts,tsx}',
  'packages/game-engine/src/**/*.ts',
]);

/** Named test helpers outside `*.test.*` that need the HTML sinks; each is a reviewed exception. */
const SINK_OPEN_HELPERS = Object.freeze([
  // Parses rasterised SVG markup with DOMParser to validate it; never inserts it.
  'packages/web/src/scene/__tests__/exerciseDecoration.ts',
]);

/** Test files, where only the HTML sinks are open (jsdom fixtures). */
export const UI_GATE_TEST_GLOBS = Object.freeze([
  'packages/web/**/*.test.{ts,tsx}',
  ...SINK_OPEN_HELPERS,
]);

/**
 * True for a file in UI_GATE_TEST_GLOBS, where the HTML sinks are open. Only these modules are
 * off limits to production imports (`ui/import-scope`, P1 QA3 H8): every other helper, under
 * `__tests__/` or `test-utils/` included, has the full gate. `registry.test.mjs` pins this
 * predicate to what ESLint resolves for the globs.
 */
export function isTestModule(file) {
  return (
    (file.startsWith(`${WEB_PACKAGE}/`) && /\.test\.tsx?$/.test(file)) ||
    SINK_OPEN_HELPERS.includes(file)
  );
}
