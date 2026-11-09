import { defineConfig, devices } from '@playwright/test';

/**
 * E2E_BASE_URL: Single source of truth for all E2E navigation.
 *
 * DEFINED HERE, exported to process.env for:
 * - webServer (via env inheritance)
 * - test runtime (ui.ts reads process.env.E2E_BASE_URL)
 *
 * Default: http://localhost:8081
 * Override: E2E_BASE_URL=https://... npx playwright test
 */
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
const LOCAL_CF_API_URL = 'http://127.0.0.1:8787';
const WEB_PORT = process.env.WEB_PORT || '8081';

// Export to process.env so ui.ts and webServer can access it
(process.env as Record<string, string | undefined>).E2E_BASE_URL = E2E_BASE_URL;

/**
 * Playwright configuration for Werewolf Game E2E tests.
 *
 * ENVIRONMENT:
 *   Two webServers launched in parallel (Playwright native):
 *   1. API — wrangler dev --local on :8787 (with D1 migration + .dev.vars setup)
 *   2. Web — production build served statically on :8081
 *      CI: workflow pre-builds `packages/web/dist/`, webServer only runs
 *      `serve` on it (deterministic, no compilation flakiness)
 *      Local: the Vite dev server, or an existing one (reuseExistingServer)
 *
 *   Playwright waits for BOTH servers to be ready before running tests.
 *
 * @see https://playwright.dev/docs/test-webserver
 */
export default defineConfig({
  testDir: './e2e/specs',

  /* Run tests in parallel */
  fullyParallel: true,

  /* Increase timeout for tests involving auth */
  timeout: 60000,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only - helps with transient connection issues */
  retries: process.env.CI ? 2 : 0,

  /* Limit workers on CI to reduce concurrent connection pressure */
  workers: process.env.CI ? 2 : undefined,

  /* Reporter to use. The failure bundle reporter always rides along: it is
   * silent on green runs and writes failure-bundles/ only when a test ends
   * failed or flaky (see e2e/reporters/failureBundle.ts). CI passes explicit
   * --reporter flags on the command line, which replace this list, so the CI
   * workflows name the bundle reporter there as well. */
  reporter: [['html'], ['./e2e/reporters/failureBundle.ts']],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: E2E_BASE_URL,

    /* Collect trace on failure for debugging via `npx playwright show-trace` */
    trace: 'retain-on-failure',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /fibking-responsive\.spec/,
    },

    /* Narrow viewport (320×640) — catches responsive overflow on small Android phones */
    {
      name: 'small-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
      },
      testMatch: /home\.spec|config\.spec|fibking-responsive\.spec/,
    },
  ],

  /* Launch API + Web servers in parallel, wait for both before running tests */
  webServer: [
    {
      name: 'API',
      command:
        'node scripts/setup-e2e-api.mjs && pnpm --filter @game-judge/api-worker run dev:test',
      url: `${LOCAL_CF_API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'Web',
      // CI: `packages/web/dist/` is pre-built by the workflow's "Build web" step, so
      // the webServer only starts `serve` (near-instant readiness); a build inside
      // the webServer would share its readiness timeout (#79/#80).
      command: process.env.CI
        ? `npx serve packages/web/dist -l ${WEB_PORT} -s`
        : `pnpm --filter @game-judge/web run dev --port ${WEB_PORT} --strictPort`,
      url: E2E_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000, // static serve starts in seconds
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        VITE_CF_API_URL: LOCAL_CF_API_URL,
        // Disable Sentry in E2E builds — test errors must not pollute production
        VITE_SENTRY_DSN: '',
      },
    },
  ],
});
