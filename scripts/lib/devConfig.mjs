/**
 * Shared dev-server configuration utilities.
 *
 * Single source of truth for:
 * - Required env field list
 * - Loading & validating config from env/*.json
 * - Writing managed vars to .env.local
 * - Spawning child processes with signal forwarding
 *
 * Consumed by: run-e2e-web.mjs, dev-api.mjs
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Constants ───────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT_DIR = join(__dirname, '..', '..');

/**
 * All env fields that MUST be present in env/e2e.*.json.
 * Edge Functions auto-inject DB URL via supabase CLI — only client-facing vars needed.
 */
const REQUIRED_FIELDS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

/**
 * Keys written into .env.local (managed section).
 * Metro reads EXPO_PUBLIC_* at bundle time; non-managed lines are preserved.
 */
export const MANAGED_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_URL',
];

/**
 * Supabase Edge Functions base URL for local development.
 * `supabase functions serve` routes through the local API gateway.
 */
export const LOCAL_FUNCTIONS_URL = 'http://127.0.0.1:54321/functions/v1';

// ─── loadConfig ──────────────────────────────────────────────────────────────

/**
 * Load and validate configuration from env/e2e.{envName}.json.
 *
 * @param {string} envName - 'local' | 'remote'
 * @param {{ allowEnvFallback?: boolean }} opts
 *   When true, missing JSON fields fall back to process.env (used for remote).
 * @returns {Record<string, string>} validated config object
 */
export function loadConfig(envName, opts = {}) {
  const configPath = join(ROOT_DIR, 'env', `e2e.${envName}.json`);

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

  // Optional: fall back to process.env for missing fields (remote CI)
  if (opts.allowEnvFallback) {
    for (const field of REQUIRED_FIELDS) {
      if (!config[field] && process.env[field]) {
        config[field] = process.env[field];
      }
    }
  }

  const missing = REQUIRED_FIELDS.filter((f) => !config[f]);
  if (missing.length) {
    console.error(`❌ Missing required config fields: ${missing.join(', ')}`);
    if (opts.allowEnvFallback) {
      console.error(
        '   For remote env, set these via environment variables or edit env/e2e.remote.json',
      );
    }
    process.exit(1);
  }

  return config;
}

// ─── writeEnvLocal ───────────────────────────────────────────────────────────

/**
 * Write managed vars to .env.local, preserving non-managed lines.
 *
 * @param {Record<string, string>} vars - key-value pairs to write
 * @param {{ managedKeys?: string[] }} opts
 */
export function writeEnvLocal(vars, opts = {}) {
  const managedKeys = opts.managedKeys ?? Object.keys(vars);
  const envLocalPath = join(ROOT_DIR, '.env.local');

  const envContent = managedKeys
    .filter((k) => vars[k])
    .map((k) => `${k}=${vars[k]}`)
    .join('\n');

  // Preserve non-managed vars (e.g. GROQ key)
  let preserved = '';
  if (existsSync(envLocalPath)) {
    preserved = readFileSync(envLocalPath, 'utf-8')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#') && !managedKeys.some((k) => l.startsWith(k)))
      .join('\n');
  }

  const finalContent = preserved ? envContent + '\n' + preserved + '\n' : envContent + '\n';
  writeFileSync(envLocalPath, finalContent, 'utf-8');
}

// ─── buildGameEngineEsm ─────────────────────────────────────────────────────

/**
 * Build game-engine ESM bundle (required by supabase functions serve).
 */
export function buildGameEngineEsm() {
  console.log('🔧 Building game-engine ESM bundle...');
  execSync('pnpm --filter @werewolf/game-engine run build:esm', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
}

// ─── spawnProcess ────────────────────────────────────────────────────────────

/**
 * Spawn a child process with signal forwarding and exit propagation.
 *
 * @param {string} command - executable name
 * @param {string[]} args - command arguments
 * @param {{ cwd?: string }} opts
 * @returns {import('node:child_process').ChildProcess}
 */
export function spawnProcess(command, args, opts = {}) {
  const child = spawn(command, args, {
    cwd: opts.cwd ?? ROOT_DIR,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error(`❌ Failed to start ${command}:`, err.message);
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

  return child;
}
