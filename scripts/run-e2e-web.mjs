#!/usr/bin/env node
/**
 * Unified Dev / E2E Web Server Launcher
 *
 * Loads Supabase configuration based on E2E_ENV, writes .env.local, then:
 *   - local:  concurrently starts `supabase functions serve` + `expo start --web`
 *   - remote: starts `expo start --web` only (Edge Functions already deployed)
 *
 * Usage:
 *   E2E_ENV=local  node scripts/run-e2e-web.mjs   # Local Supabase + Edge Functions
 *   E2E_ENV=remote node scripts/run-e2e-web.mjs   # Remote Supabase (production)
 *
 * Default: E2E_ENV=local
 *
 * Also used as Playwright webServer command (see playwright.config.ts).
 */

import {
  buildGameEngineEsm,
  loadConfig,
  LOCAL_FUNCTIONS_URL,
  MANAGED_ENV_KEYS,
  spawnProcess,
  writeEnvLocal,
} from './lib/devConfig.mjs';

// ─── Environment ─────────────────────────────────────────────────────────────

const e2eEnv = process.env.E2E_ENV || 'local';
const validEnvs = ['local', 'remote'];

if (!validEnvs.includes(e2eEnv)) {
  console.error(`❌ Invalid E2E_ENV: "${e2eEnv}". Must be one of: ${validEnvs.join(', ')}`);
  process.exit(1);
}

console.log(`\n🔧 E2E Environment: ${e2eEnv.toUpperCase()}\n`);

// ─── Load & validate config ─────────────────────────────────────────────────

const config = loadConfig(e2eEnv, { allowEnvFallback: e2eEnv === 'remote' });

// ─── Resolve API URL ────────────────────────────────────────────────────────

const REMOTE_FUNCTIONS_URL = 'https://abmzjezdvpzyeooqhhsn.supabase.co/functions/v1';
const apiUrl = e2eEnv === 'remote' ? REMOTE_FUNCTIONS_URL : LOCAL_FUNCTIONS_URL;

// ─── Web port ───────────────────────────────────────────────────────────────
// Expo Metro default is 8081. Playwright reads E2E_BASE_URL for navigation.

const WEB_PORT = process.env.WEB_PORT || '8081';

// ─── Write .env.local ───────────────────────────────────────────────────────

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

// ─── Build & Start ──────────────────────────────────────────────────────────

if (e2eEnv === 'local') {
  // Build game-engine ESM bundle for Edge Functions
  buildGameEngineEsm();

  // Start Edge Functions + Expo web concurrently
  console.log(`🚀 Starting: supabase functions serve + expo start --web\n`);
  spawnProcess('npx', [
    'concurrently',
    '-n',
    'edge,web',
    '-c',
    'blue,green',
    'supabase functions serve',
    `expo start --web --port ${WEB_PORT}`,
  ]);
} else {
  // Remote: Edge Functions already deployed, only start Expo web
  console.log(`🚀 Starting: expo start --web (API → remote)\n`);
  spawnProcess('expo', ['start', '--web', '--port', WEB_PORT]);
}
