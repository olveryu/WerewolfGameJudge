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

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ---------- Load Supabase config ----------

const e2eEnv = process.env.E2E_ENV || 'local';
const configPath = join(rootDir, 'env', `e2e.${e2eEnv}.json`);

if (!existsSync(configPath)) {
  console.error(`❌ Config file not found: ${configPath}`);
  console.error(`   Run: cp env/e2e.local.example.json env/e2e.local.json`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch (err) {
  console.error(`❌ Failed to parse: ${configPath}`, err.message);
  process.exit(1);
}

const requiredFields = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const missing = requiredFields.filter((f) => !config[f]);
if (missing.length) {
  console.error(`❌ Missing config fields: ${missing.join(', ')}`);
  process.exit(1);
}

// ---------- Write .env.local ----------
// Ensures Metro (started separately) picks up  the correct Supabase URL
// AND the cross-origin API_URL pointing at this vercel dev instance.

const API_PORT = process.env.API_PORT || '3000';
const apiUrl = `http://localhost:${API_PORT}`;

const envLocalPath = join(rootDir, '.env.local');
const supabaseLines = [
  `EXPO_PUBLIC_SUPABASE_URL=${config.EXPO_PUBLIC_SUPABASE_URL}`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=${config.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
  `EXPO_PUBLIC_API_URL=${apiUrl}`,
];

// Preserve non-Supabase, non-API_URL vars from existing .env.local
let preserved = '';
if (existsSync(envLocalPath)) {
  preserved = readFileSync(envLocalPath, 'utf-8')
    .split('\n')
    .filter(
      (l) =>
        l.trim() &&
        !l.startsWith('#') &&
        !l.startsWith('EXPO_PUBLIC_SUPABASE_') &&
        !l.startsWith('EXPO_PUBLIC_API_URL'),
    )
    .join('\n');
}

const finalContent = [...supabaseLines, ...(preserved ? [preserved] : []), ''].join('\n');
writeFileSync(envLocalPath, finalContent, 'utf-8');

console.log(`\n🔧 Two-process dev mode (API-only)`);
console.log(`📝 .env.local written:`);
console.log(`   EXPO_PUBLIC_SUPABASE_URL=${config.EXPO_PUBLIC_SUPABASE_URL}`);
console.log(`   EXPO_PUBLIC_API_URL=${apiUrl}`);
console.log(`📡 API server: ${apiUrl}`);
console.log(`🖥️  Start Metro separately: pnpm run web\n`);

// ---------- Start vercel dev (API-only, no frontend) ----------

const childEnv = {
  ...process.env,
  EXPO_PUBLIC_SUPABASE_URL: config.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: config.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_URL: config.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY,
  npm_config_registry: 'https://registry.npmjs.org/',
};

// Override devCommand to a no-op so vercel dev only serves /api/** routes
// without spawning Expo/Metro (which runs separately on :8081).
const vercelArgs = ['dev', '--listen', API_PORT, '--yes'];

console.log(`🚀 Starting: vercel ${vercelArgs.join(' ')}\n`);

const child = spawn('vercel', vercelArgs, {
  cwd: rootDir,
  env: childEnv,
  stdio: 'inherit',
  shell: true,
});

child.on('error', (err) => {
  console.error(`❌ Failed to start vercel dev:`, err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    child.kill(signal);
  });
});
