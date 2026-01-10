#!/usr/bin/env node
/**
 * E2E Web Server Launcher
 * 
 * Loads Supabase configuration based on E2E_ENV and starts Expo web server.
 * 
 * Usage:
 *   E2E_ENV=local node scripts/run-e2e-web.mjs   # Use local Supabase (127.0.0.1:54321)
 *   E2E_ENV=remote node scripts/run-e2e-web.mjs  # Use remote Supabase (production/shared)
 * 
 * Default: E2E_ENV=local
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
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
const requiredFields = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const missing = requiredFields.filter(field => !config[field]);

// For remote env, allow override from environment variables
if (e2eEnv === 'remote') {
  for (const field of requiredFields) {
    if (!config[field] && process.env[field]) {
      config[field] = process.env[field];
    }
  }
}

// Re-check after env override
const stillMissing = requiredFields.filter(field => !config[field]);
if (stillMissing.length > 0) {
  console.error(`❌ Missing required config fields: ${stillMissing.join(', ')}`);
  if (e2eEnv === 'remote') {
    console.error('   For remote env, set these via environment variables or edit env/e2e.remote.json');
  }
  process.exit(1);
}

// === E2E_BASE_URL: Single source of truth for all E2E navigation ===
const E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8081';

// Log configuration (not the key for security)
console.log(`🌐 E2E Base URL: ${E2E_BASE_URL} (single source of truth)`);
console.log(`📡 Supabase URL: ${config.EXPO_PUBLIC_SUPABASE_URL}`);
console.log(`🔑 Supabase Key: [configured, ${config.EXPO_PUBLIC_SUPABASE_ANON_KEY.length} chars]\n`);

// Prepare environment for child process
const childEnv = {
  ...process.env,
  // E2E_BASE_URL injected for Playwright tests (ui.ts reads this)
  E2E_BASE_URL,
  EXPO_PUBLIC_SUPABASE_URL: config.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: config.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

// Start Expo web server
// Port must match E2E_BASE_URL (default 8081)
const port = new URL(E2E_BASE_URL).port || '8081';
const expoArgs = ['expo', 'start', '--web', '--port', port];
console.log(`🚀 Starting: npx ${expoArgs.join(' ')}\n`);

const child = spawn('npx', expoArgs, {
  cwd: rootDir,
  env: childEnv,
  stdio: 'inherit',
  shell: true,
});

child.on('error', (err) => {
  console.error(`❌ Failed to start Expo:`, err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

// Forward signals to child process
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    child.kill(signal);
  });
});
