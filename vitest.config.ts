import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Root project: cross-package contracts and the new-game generator suite.
 * Each package runs its own unit tests.
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
    include: [
      'contracts/**/*.test.ts',
      'scripts/new-game.test.mjs',
      'scripts/dev.test.mjs',
      'scripts/ui-lint/*.test.mjs',
    ],
  },
});
