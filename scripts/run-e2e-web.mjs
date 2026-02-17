#!/usr/bin/env node
/**
 * E2E Web Server Launcher
 *
 * Loads Supabase configuration based on E2E_ENV and starts `vercel dev`.
 * `vercel dev` serves both the Expo frontend AND /api/** serverless functions.
 *
 * Usage:
 *   E2E_ENV=local node scripts/run-e2e-web.mjs   # Use local Supabase (127.0.0.1:54321)
 *   E2E_ENV=remote node scripts/run-e2e-web.mjs  # Use remote Supabase (production/shared)
 *
 * Default: E2E_ENV=local
 */

import {
  buildChildEnv,
  loadConfig,
  MANAGED_ENV_KEYS,
  spawnVercelDev,
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

// ─── E2E_BASE_URL ───────────────────────────────────────────────────────────
// When launched by Playwright, playwright.config.ts sets this.
// When launched standalone (`pnpm run dev`), default to localhost:3000.

const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// ─── Write .env.local ───────────────────────────────────────────────────────

const envVars = {};
for (const k of MANAGED_ENV_KEYS) {
  if (config[k]) envVars[k] = config[k];
}
writeEnvLocal(envVars, { managedKeys: MANAGED_ENV_KEYS });
console.log(`📝 .env.local written (${MANAGED_ENV_KEYS.length} managed vars, env=${e2eEnv})`);

// ─── Log ────────────────────────────────────────────────────────────────────

console.log(`🌐 E2E Base URL: ${E2E_BASE_URL} (from playwright.config.ts)`);
console.log(`📡 Supabase URL: ${config.EXPO_PUBLIC_SUPABASE_URL}`);
console.log(`🔑 Supabase Key: [configured, ${config.EXPO_PUBLIC_SUPABASE_ANON_KEY.length} chars]`);
console.log(`🗄️  DATABASE_URL: [configured, ${config.DATABASE_URL.length} chars]\n`);

// ─── Start vercel dev (frontend + API) ──────────────────────────────────────

const port = new URL(E2E_BASE_URL).port || '3000';
const childEnv = buildChildEnv(config);

spawnVercelDev({ port, childEnv });
