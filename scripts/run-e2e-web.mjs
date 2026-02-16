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

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Determine environment (default: local)
const e2eEnv = process.env.E2E_ENV || 'local';
const validEnvs = ['local', 'remote'];

if (!validEnvs.includes(e2eEnv)) {
  console.error(`❌ Invalid E2E_ENV: "${e2eEnv}". Must be one of: ${validEnvs.join(', ')}`);
  process.exit(1);
}

console.log(`\n🔧 E2E Environment: ${e2eEnv.toUpperCase()}\n`);

// Load configuration from env/*.json
const configPath = join(rootDir, 'env', `e2e.${e2eEnv}.json`);

if (!existsSync(configPath)) {
  console.error(`❌ Config file not found: ${configPath}`);
  process.exit(1);
}

let config;
try {
  const configContent = readFileSync(configPath, 'utf-8');
  config = JSON.parse(configContent);
} catch (err) {
  console.error(`❌ Failed to parse config file: ${configPath}`);
  console.error(err.message);
  process.exit(1);
}

// Validate required fields
const requiredFields = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
];
const missing = requiredFields.filter((field) => !config[field]);

// For remote env, allow override from environment variables
if (e2eEnv === 'remote') {
  for (const field of requiredFields) {
    if (!config[field] && process.env[field]) {
      config[field] = process.env[field];
    }
  }
}

// Re-check after env override
const stillMissing = requiredFields.filter((field) => !config[field]);
if (stillMissing.length > 0) {
  console.error(`❌ Missing required config fields: ${stillMissing.join(', ')}`);
  if (e2eEnv === 'remote') {
    console.error(
      '   For remote env, set these via environment variables or edit env/e2e.remote.json',
    );
  }
  process.exit(1);
}

// === E2E_BASE_URL: Read from environment (set by playwright.config.ts) ===
// When launched by Playwright, playwright.config.ts sets this.
// When launched standalone (`pnpm run dev`), default to localhost:3000.
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// === Auto-generate .env.local ===
// vercel dev reads .env.local for serverless function env vars (community standard).
// Expo/Metro also reads .env.local > .env for EXPO_PUBLIC_* vars.
// We write ALL required vars here so both frontend and API routes get correct config.
{
  const envLocalPath = join(rootDir, '.env.local');

  // Managed keys — will be overwritten every run
  const managedKeys = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
  ];

  const envLocalContent = managedKeys
    .filter((k) => config[k])
    .map((k) => `${k}=${config[k]}`)
    .join('\n');

  // Preserve non-managed vars if .env.local already exists (e.g. GROQ key)
  let preserved = '';
  if (existsSync(envLocalPath)) {
    const existing = readFileSync(envLocalPath, 'utf-8');
    preserved = existing
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#') && !managedKeys.some((k) => l.startsWith(k)))
      .join('\n');
  }

  const finalContent = preserved
    ? envLocalContent + '\n' + preserved + '\n'
    : envLocalContent + '\n';
  writeFileSync(envLocalPath, finalContent, 'utf-8');
  console.log(`📝 .env.local written (${managedKeys.length} managed vars, env=${e2eEnv})`);
}

// Log configuration (not the key for security)
console.log(`🌐 E2E Base URL: ${E2E_BASE_URL} (from playwright.config.ts)`);
console.log(`📡 Supabase URL: ${config.EXPO_PUBLIC_SUPABASE_URL}`);
console.log(`🔑 Supabase Key: [configured, ${config.EXPO_PUBLIC_SUPABASE_ANON_KEY.length} chars]`);
console.log(`🗄️  DATABASE_URL: [configured, ${config.DATABASE_URL.length} chars]\n`);

// Prepare environment for child process
const childEnv = {
  ...process.env,
  EXPO_PUBLIC_SUPABASE_URL: config.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: config.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  // Server-side env vars for API routes (Vercel serverless functions)
  ...(config.SUPABASE_URL && { SUPABASE_URL: config.SUPABASE_URL }),
  ...(config.SUPABASE_SERVICE_ROLE_KEY && {
    SUPABASE_SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY,
  }),
  ...(config.DATABASE_URL && { DATABASE_URL: config.DATABASE_URL }),
  // Force official npm registry for vercel dev's internal builder installs
  // (avoids hanging on slow corporate proxies like Nexus)
  npm_config_registry: 'https://registry.npmjs.org/',
};

// Start vercel dev (serves both frontend via Expo AND /api/** serverless functions)
const port = new URL(E2E_BASE_URL).port || '3000';
const vercelArgs = ['dev', '--listen', port, '--yes'];

// In CI, vercel dev needs an explicit token for authentication
if (process.env.VERCEL_TOKEN) {
  vercelArgs.push('--token', process.env.VERCEL_TOKEN);
}

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

// Forward signals to child process
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    child.kill(signal);
  });
});
