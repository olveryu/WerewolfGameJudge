import { defineConfig } from 'vitest/config';

/**
 * The UI gate's own suite. It lints real files, builds the web bundle with Vite and spawns
 * linters, so it runs in the CI lint job beside the gate rather than in a shared test shard,
 * where it competed for the runner's CPU with time-limited contract tests (P1 QA11 F7).
 */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    environment: 'node',
    include: ['*.test.mjs'],
  },
});
