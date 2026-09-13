import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.test.toml' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            JWT_SECRET: 'e2e-test-jwt-secret-do-not-use-in-production',
          },
        },
      }),
    ],
    resolve: {
      alias: {
        '@game-judge/game-engine': path.resolve(__dirname, '../game-engine/src'),
      },
    },
    test: {
      include: ['src/**/__tests__/**/*.test.ts'],
      setupFiles: ['./test/applyMigrations.ts'],
      testTimeout: 15_000,
    },
  };
});
