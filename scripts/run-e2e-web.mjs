#!/usr/bin/env node
/**
 * Dev / E2E Web Server Launcher
 *
 * Starts wrangler dev --local + expo start --web for local development and E2E tests.
 *
 * Usage:
 *   node scripts/run-e2e-web.mjs
 *
 * Also used as Playwright webServer command (see playwright.config.ts).
 */

import {
  applyD1Migrations,
  LOCAL_CF_API_URL,
  MANAGED_ENV_KEYS,
  spawnProcess,
  writeDevVars,
  writeEnvLocal,
} from './lib/devConfig.mjs';

// ─── Web port ───────────────────────────────────────────────────────────────
// Expo Metro default is 8081. Playwright reads E2E_BASE_URL for navigation.

const WEB_PORT = process.env.WEB_PORT || '8081';

writeEnvLocal(
  {
    EXPO_PUBLIC_CF_API_URL: LOCAL_CF_API_URL,
  },
  { managedKeys: MANAGED_ENV_KEYS },
);

console.log(`📝 .env.local written (API → ${LOCAL_CF_API_URL})`);
console.log(`🌐 Web server: http://localhost:${WEB_PORT}`);
console.log(`📡 API: ${LOCAL_CF_API_URL}\n`);

// Apply D1 schema to local SQLite
applyD1Migrations();

// Write .dev.vars for wrangler dev (local secrets)
writeDevVars();

// Start wrangler dev + Expo web concurrently
console.log(`🚀 Starting: wrangler dev --local + expo start --web\n`);
spawnProcess('npx', [
  'concurrently',
  '-n',
  'worker,web',
  '-c',
  'blue,green',
  '"pnpm --filter @werewolf/api-worker run dev"',
  `"expo start --web --port ${WEB_PORT}"`,
]);
