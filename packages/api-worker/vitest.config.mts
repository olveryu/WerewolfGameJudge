import path from 'node:path';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
    }),
  ],
  resolve: {
    alias: {
      '@werewolf/game-engine': path.resolve(__dirname, '../game-engine/src'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
