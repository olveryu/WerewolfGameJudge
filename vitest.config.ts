import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Root contract project: cross-package rules over the engine, the Worker, the web client source,
 * E2E, CI and scripts. Each package runs its own unit tests.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@game-judge/game-engine': path.resolve(import.meta.dirname, 'packages/game-engine/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['contracts/**/*.test.ts'],
  },
});
