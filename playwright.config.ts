import { defineConfig, devices } from '@playwright/test';

/**
 * E2E_BASE_URL: Single source of truth for all E2E navigation.
 *
 * DEFINED HERE, exported to process.env for:
 * - webServer (via env inheritance)
 * - test runtime (ui.ts reads process.env.E2E_BASE_URL)
 *
 * Default: http://localhost:8081 (Expo Metro web default)
 * Override: E2E_BASE_URL=https://... npx playwright test
 */
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
const LOCAL_CF_API_URL = 'http://127.0.0.1:8787';
const WEB_PORT = process.env.WEB_PORT || '8081';

// Export to process.env so ui.ts and webServer can access it
process.env.E2E_BASE_URL = E2E_BASE_URL;

/**
 * Playwright configuration for Werewolf Game E2E tests.
 *
 * ENVIRONMENT:
 *   Two webServers launched in parallel (Playwright native):
 *   1. API — wrangler dev --local on :8787 (with D1 migration + .dev.vars setup)
 *   2. Web — Expo Metro on :8081 (reads EXPO_PUBLIC_CF_API_URL via env injection)
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

  /* Reporter to use */
  reporter: 'html',

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
    },

    /* Narrow viewport (320×640) — catches responsive overflow on small Android phones */
    {
      name: 'small-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
      },
      // Only run home + config specs — enough to catch layout overflow
      testMatch: /home\.spec|config\.spec/,
    },
  ],

  /* Launch API + Web servers in parallel, wait for both before running tests */
  webServer: [
    {
      name: 'API',
      command: 'node scripts/setup-e2e-api.mjs && pnpm --filter @werewolf/api-worker run dev:test',
      url: `${LOCAL_CF_API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'Web',
      command: `npx expo start --web --port ${WEB_PORT}`,
      url: E2E_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        EXPO_PUBLIC_CF_API_URL: LOCAL_CF_API_URL,
      },
    },
  ],
});
