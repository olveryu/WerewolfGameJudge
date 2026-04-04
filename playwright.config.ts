import { defineConfig, devices } from '@playwright/test';

import { ALL_GUIDE_DISMISSED_KEYS } from './src/config/storageKeys';

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

// Export to process.env so ui.ts and webServer can access it
process.env.E2E_BASE_URL = E2E_BASE_URL;

/**
 * Playwright configuration for Werewolf Game E2E tests.
 *
 * ENVIRONMENT:
 *   Uses wrangler dev --local for API + Expo web for frontend.
 *   No config file needed — uses wrangler dev --local on :8787.
 *
 * CONNECTION_REFUSED HANDLING:
 *   If tests fail with ERR_CONNECTION_REFUSED:
 *   1. Check webServer logs in terminal (stdout: 'pipe')
 *   2. Verify port 8081 not occupied: lsof -i :8081
 *   3. webServer.timeout is 120s to allow slow server starts
 *   4. Tests use gotoWithRetry() for automatic retry on connection issues
 *
 * @see https://playwright.dev/docs/test-configuration
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

  /* Limit workers on CI to reduce Supabase concurrent connection pressure */
  workers: process.env.CI ? 2 : undefined,

  /* Reporter to use */
  reporter: 'html',

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: E2E_BASE_URL,

    /* Pre-seed localStorage to dismiss all page guide modals.
     * AsyncStorage on web = window.localStorage. This prevents onboarding
     * modals from appearing and avoids "知道了" text collisions in tests. */
    storageState: {
      cookies: [],
      origins: [
        {
          origin: E2E_BASE_URL,
          localStorage: ALL_GUIDE_DISMISSED_KEYS.map((key) => ({ name: key, value: '1' })),
        },
      ],
    },

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

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'node scripts/run-e2e-web.mjs',
    // Playwright waits for this URL to be accessible before running tests
    // This is the primary "ready check" - ensures server is actually serving
    url: E2E_BASE_URL,
    // Local: reuse existing server (faster dev iteration)
    // CI: always start fresh (reproducible)
    reuseExistingServer: !process.env.CI,
    // 2 minutes for slow server starts (Metro bundler can be slow on first run)
    timeout: 120 * 1000,
    // Pipe output for diagnosis when server fails to start
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
