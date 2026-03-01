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

// Export to process.env so ui.ts and webServer can access it
process.env.E2E_BASE_URL = E2E_BASE_URL;

/**
 * Playwright configuration for Werewolf Game E2E tests.
 *
 * ENVIRONMENT SWITCHING:
 *   E2E_ENV=local npx playwright test   # Use local Supabase (127.0.0.1:54321)
 *   E2E_ENV=remote npx playwright test  # Use remote Supabase
 *
 * Configuration is loaded from env/e2e.{local,remote}.json by scripts/run-e2e-web.mjs.
 * Local mode starts Edge Functions + Expo web; remote mode starts Expo web only.
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

  /* Use all available workers for parallel tests.
   * CI: limit to 2 to reduce concurrent Supabase Realtime connections —
   * too many postgres_changes subscribers cause event drops. */
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
    env: {
      E2E_ENV: process.env.E2E_ENV || 'local',
    },
  },
});
