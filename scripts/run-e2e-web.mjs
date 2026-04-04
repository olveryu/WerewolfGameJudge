#!/usr/bin/env node
/**
 * Unified Dev / E2E Web Server Launcher
 *
 * Loads configuration based on E2E_ENV, writes .env.local, then starts servers:
 *   - local:      supabase functions serve + expo start --web (Docker required)
 *   - remote:     expo start --web only (Supabase Edge Functions already deployed)
 *   - cloudflare: wrangler dev --local + expo start --web (no Docker, no Supabase)
 *
 * Usage:
 *   E2E_ENV=local       node scripts/run-e2e-web.mjs
 *   E2E_ENV=remote      node scripts/run-e2e-web.mjs
 *   E2E_ENV=cloudflare  node scripts/run-e2e-web.mjs
 *
 * Default: E2E_ENV=local
 *
 * Also used as Playwright webServer command (see playwright.config.ts).
 */

import {
  applyD1Migrations,
  buildGameEngineEsm,
  ensureSupabaseRunning,
  loadConfig,
  LOCAL_CF_API_URL,
  LOCAL_FUNCTIONS_URL,
  MANAGED_ENV_KEYS,
  spawnProcess,
  writeDevVars,
  writeEnvLocal,
} from './lib/devConfig.mjs';

// ─── Environment ─────────────────────────────────────────────────────────────

const e2eEnv = process.env.E2E_ENV || 'local';
const validEnvs = ['local', 'remote', 'cloudflare'];

if (!validEnvs.includes(e2eEnv)) {
  console.error(`❌ Invalid E2E_ENV: "${e2eEnv}". Must be one of: ${validEnvs.join(', ')}`);
  process.exit(1);
}

console.log(`\n🔧 E2E Environment: ${e2eEnv.toUpperCase()}\n`);

// ─── Web port ───────────────────────────────────────────────────────────────
// Expo Metro default is 8081. Playwright reads E2E_BASE_URL for navigation.

const WEB_PORT = process.env.WEB_PORT || '8081';

// ─── Cloudflare mode ────────────────────────────────────────────────────────

if (e2eEnv === 'cloudflare') {
  writeEnvLocal(
    {
      EXPO_PUBLIC_BACKEND: 'cloudflare',
      EXPO_PUBLIC_CF_API_URL: LOCAL_CF_API_URL,
    },
    { managedKeys: MANAGED_ENV_KEYS },
  );

  console.log(`📝 .env.local written (backend=cloudflare, API → ${LOCAL_CF_API_URL})`);
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
} else {
  // ─── Supabase modes (local / remote) ────────────────────────────────────

  const config = loadConfig(e2eEnv, { allowEnvFallback: e2eEnv === 'remote' });

  const REMOTE_FUNCTIONS_URL = 'https://abmzjezdvpzyeooqhhsn.supabase.co/functions/v1';
  const apiUrl = e2eEnv === 'remote' ? REMOTE_FUNCTIONS_URL : LOCAL_FUNCTIONS_URL;

  writeEnvLocal(
    {
      EXPO_PUBLIC_SUPABASE_URL: config.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: config.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_API_URL: apiUrl,
    },
    { managedKeys: MANAGED_ENV_KEYS },
  );

  console.log(`📝 .env.local written (env=${e2eEnv}, API → ${apiUrl})`);
  console.log(`🌐 Web server: http://localhost:${WEB_PORT}`);
  console.log(`📡 API: ${apiUrl}\n`);

  if (e2eEnv === 'local') {
    ensureSupabaseRunning();
    buildGameEngineEsm();
    console.log(`🚀 Starting: supabase functions serve + expo start --web\n`);
    spawnProcess('npx', [
      'concurrently',
      '-n',
      'edge,web',
      '-c',
      'blue,green',
      '"supabase functions serve"',
      `"expo start --web --port ${WEB_PORT}"`,
    ]);
  } else {
    console.log(`🚀 Starting: expo start --web (API → remote)\n`);
    spawnProcess('expo', ['start', '--web', '--port', WEB_PORT]);
  }
}
