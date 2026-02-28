#!/usr/bin/env node
/**
 * Edge Functions Dev Server — starts `supabase functions serve`.
 *
 * Used in the two-process local development workflow:
 *   Terminal 1: `pnpm run web`          → Metro :8081 (frontend, hot-reload)
 *   Terminal 2: `pnpm run dev:functions` → supabase functions serve (Edge Functions, hot-reload)
 *
 * Loads Supabase configuration from env/e2e.local.json, writes .env.local so
 * Metro picks up EXPO_PUBLIC_API_URL pointing at the local Supabase gateway.
 *
 * Prerequisite: `supabase start` must be running.
 */

import {
  buildGameEngineEsm,
  ensureSupabaseRunning,
  loadConfig,
  LOCAL_FUNCTIONS_URL,
  MANAGED_ENV_KEYS,
  spawnProcess,
  writeEnvLocal,
} from './lib/devConfig.mjs';

// ---------- Load Supabase config ----------

const config = loadConfig('local');

// ---------- Write .env.local ----------

writeEnvLocal(
  {
    EXPO_PUBLIC_SUPABASE_URL: config.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: config.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_API_URL: LOCAL_FUNCTIONS_URL,
  },
  { managedKeys: MANAGED_ENV_KEYS },
);

console.log(`\n🔧 Two-process dev mode (Edge Functions only)`);
console.log(`📝 .env.local written:`);
console.log(`   EXPO_PUBLIC_SUPABASE_URL=[configured]`);
console.log(`   EXPO_PUBLIC_API_URL=${LOCAL_FUNCTIONS_URL}`);
console.log(`🖥️  Start Metro separately: pnpm run web\n`);

// ---------- Ensure Supabase is running ----------

ensureSupabaseRunning();

// ---------- Build game-engine ESM ----------

buildGameEngineEsm();

// ---------- Start supabase functions serve ----------

console.log(`\n🚀 Starting: supabase functions serve\n`);

spawnProcess('supabase', ['functions', 'serve']);
