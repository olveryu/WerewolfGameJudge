import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Werewolf Game E2E tests.
 * 
 * ENVIRONMENT SWITCHING:
 *   E2E_ENV=local npx playwright test   # Use local Supabase (127.0.0.1:54321)
 *   E2E_ENV=remote npx playwright test  # Use remote Supabase
 * 
 * Configuration is loaded from env/e2e.{local,remote}.json by scripts/run-e2e-web.mjs
 * 
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  
  /* Run tests in parallel */
  fullyParallel: true,
  
  /* Increase timeout for tests involving auth */
  timeout: 60000,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Use all available workers for parallel tests */
  workers: process.env.CI ? 4 : undefined,
  
  /* Reporter to use */
  reporter: 'html',
  
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:8081',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
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
    url: 'http://localhost:8081',
    reuseExistingServer: true,  // Always reuse existing server
    timeout: 120 * 1000,
    stdout: 'pipe',  // Pipe stdout so we can see test output
    env: {
      E2E_ENV: process.env.E2E_ENV || 'local',
    },
  },
});
