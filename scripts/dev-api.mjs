#!/usr/bin/env node
/**
 * API-only Dev Server — starts `vercel dev` WITHOUT Expo/Metro.
 *
 * Used in the two-process local development workflow:
 *   Terminal 1: `pnpm run web`     → Metro :8081 (frontend, hot-reload)
 *   Terminal 2: `pnpm run dev:api` → vercel dev :3000 (API only)
 *
 * Loads Supabase configuration from env/e2e.local.json (same as run-e2e-web.mjs),
 * and writes EXPO_PUBLIC_API_URL=http://localhost:3000 into .env.local so that
 * Metro picks it up for cross-origin API calls.
 *
 * Default: E2E_ENV=local (local Supabase at 127.0.0.1:54321)
 */

import { buildChildEnv, loadConfig, spawnVercelDev, writeEnvLocal } from './lib/devConfig.mjs';

// ---------- Load Supabase config ----------

const e2eEnv = process.env.E2E_ENV || 'local';
const config = loadConfig(e2eEnv);

// ---------- Write .env.local ----------
// Ensures Metro (started separately) picks up the correct Supabase URL
// AND the cross-origin API_URL pointing at this vercel dev instance.

const API_PORT = process.env.API_PORT || '3000';
const apiUrl = `http://localhost:${API_PORT}`;

// For API-only mode we only expose EXPO_PUBLIC_* vars (for Metro) + API_URL.
// Server-side vars are passed directly via childEnv — no need to leak them into .env.local.
const managedKeys = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_URL',
];

writeEnvLocal(
  {
    EXPO_PUBLIC_SUPABASE_URL: config.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: config.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_API_URL: apiUrl,
  },
  { managedKeys },
);

console.log(`\n🔧 Two-process dev mode (API-only)`);
console.log(`📝 .env.local written:`);
console.log(`   EXPO_PUBLIC_SUPABASE_URL=[configured]`);
console.log(`   EXPO_PUBLIC_API_URL=${apiUrl}`);
console.log(`📡 API server: ${apiUrl}`);
console.log(`🖥️  Start Metro separately: pnpm run web\n`);

// ---------- Start vercel dev (API-only, no frontend) ----------

const childEnv = buildChildEnv(config);

spawnVercelDev({ port: API_PORT, childEnv });
