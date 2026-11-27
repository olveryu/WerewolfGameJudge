import { defineConfig, devices } from '@playwright/test';

import base from './playwright.config';

/**
 * Visual gate (UI drift lock P2): screenshots of the shared-component gallery
 * (`/__bench/ui`) and the key pages, compared with the baselines committed in
 * `e2e/visual/__screenshots__/`.
 *
 * Baselines are only valid from one rendering environment, the official
 * Playwright image pinned to the installed `@playwright/test` version (fonts,
 * Chromium build, Skia). Run it only through `scripts/e2e-visual.mjs`
 * (`pnpm run e2e:visual`, `pnpm run e2e:visual:update`), which CI uses too.
 *
 * The servers, base URL and timeouts are the e2e config's own; this file
 * changes only what a screenshot comparison needs.
 */
export default defineConfig({
  ...base,
  testDir: './e2e/visual',
  // A retry would turn a flaky screenshot into a pass; the gate must be
  // deterministic on the first try.
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-visual' }]],
  outputDir: 'test-results-visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  // A compare run never writes a baseline, not even a missing one: it fails and leaves the
  // actual image in outputDir. Only `--update` (scripts/e2e-visual.mjs) rewrites baselines.
  updateSnapshots: 'none',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Zero tolerance: the environment is pinned, so any pixel is a change.
      maxDiffPixels: 0,
    },
  },
  use: {
    ...base.use,
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'visual-390',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        colorScheme: 'light',
        reducedMotion: 'reduce',
      },
    },
  ],
});
