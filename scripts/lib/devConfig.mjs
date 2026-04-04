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
 *
 * Supports three E2E_ENV modes:
 *   - local:      Supabase CLI + Edge Functions (Docker required)
 *   - remote:     Remote Supabase (Edge Functions already deployed)
 *   - cloudflare: wrangler dev --local (no Docker, no Supabase)
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Constants ───────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..', '..');

/**
 * All env fields that MUST be present in env/e2e.*.json (Supabase modes).
 * Edge Functions auto-inject DB URL via supabase CLI — only client-facing vars needed.
 * Cloudflare mode does not require these fields.
 */
const SUPABASE_REQUIRED_FIELDS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

/**
 * Keys written into .env.local (managed section).
 * Metro reads EXPO_PUBLIC_* at bundle time; non-managed lines are preserved.
 */
export const MANAGED_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_BACKEND',
  'EXPO_PUBLIC_CF_API_URL',
];

/**
 * Supabase Edge Functions base URL for local development.
 * `supabase functions serve` routes through the local API gateway.
 */
export const LOCAL_FUNCTIONS_URL = 'http://127.0.0.1:54321/functions/v1';

/**
 * Local wrangler dev URL (default port for `wrangler dev`).
 */
export const LOCAL_CF_API_URL = 'http://127.0.0.1:8787';

// ─── loadConfig ──────────────────────────────────────────────────────────────

/**
 * Load and validate configuration from env/e2e.{envName}.json.
 *
 * @param {string} envName - 'local' | 'remote' | 'cloudflare'
 * @param {{ allowEnvFallback?: boolean }} opts
 *   When true, missing JSON fields fall back to process.env (used for remote).
 * @returns {Record<string, string>} validated config object (empty for cloudflare)
 */
export function loadConfig(envName, opts = {}) {
  // Cloudflare mode needs no config file — everything is hard-coded / env-driven
  if (envName === 'cloudflare') {
    return {};
  }

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
    for (const field of SUPABASE_REQUIRED_FIELDS) {
      if (!config[field] && process.env[field]) {
        config[field] = process.env[field];
      }
    }
  }

  const missing = SUPABASE_REQUIRED_FIELDS.filter((f) => !config[f]);
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

  // Preserve non-managed vars (e.g. Gemini key)
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

// ─── ensureSupabaseRunning ───────────────────────────────────────────────────

/**
 * Ensure local Supabase stack is running (idempotent).
 *
 * Checks `supabase status` — if not running, runs `supabase start`.
 * Requires Docker and supabase CLI to be installed.
 */
export function ensureSupabaseRunning() {
  try {
    execSync('supabase status', { cwd: ROOT_DIR, stdio: 'ignore' });
    console.log('✅ Supabase is already running');
  } catch {
    console.log('🐳 Supabase not running — starting...');
    try {
      execSync('supabase start', { cwd: ROOT_DIR, stdio: 'inherit' });
      console.log('✅ Supabase started');
    } catch (err) {
      console.error('❌ Failed to start Supabase. Is Docker running? Is supabase CLI installed?');
      console.error('   Install: brew install supabase/tap/supabase');
      process.exit(1);
    }
  }
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

// ─── writeDevVars ────────────────────────────────────────────────────────────

/**
 * Write a .dev.vars file in the api-worker package for wrangler dev local secrets.
 *
 * wrangler dev reads .dev.vars automatically for secrets (JWT_SECRET, etc.)
 * that aren't in wrangler.toml [vars].
 */
export function writeDevVars() {
  const devVarsPath = join(ROOT_DIR, 'packages', 'api-worker', '.dev.vars');
  const content = [
    '# Auto-generated by run-e2e-web.mjs — DO NOT COMMIT',
    'JWT_SECRET=e2e-test-jwt-secret-do-not-use-in-production',
    '',
  ].join('\n');
  writeFileSync(devVarsPath, content, 'utf-8');
  console.log('🔑 .dev.vars written (JWT_SECRET for local wrangler dev)');
}

// ─── applyD1Migrations ───────────────────────────────────────────────────────

/**
 * Apply D1 migrations locally via wrangler CLI.
 * Only needed for cloudflare E2E mode — ensures local D1 has the schema.
 *
 * Uses pipe stdio so wrangler detects non-interactive context and auto-confirms.
 */
export function applyD1Migrations() {
  const workerDir = join(ROOT_DIR, 'packages', 'api-worker');
  console.log('🗄️  Applying D1 migrations (local)...');
  try {
    const output = execSync('pnpm run db:migrate:local', {
      cwd: workerDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    console.log(output);
    console.log('✅ D1 migrations applied');
  } catch (err) {
    // execSync throws on non-zero exit but wrangler may still succeed
    // Check if the output contains success indicators
    const combined = (err.stdout || '') + (err.stderr || '');
    if (combined.includes('✅') || combined.includes('executed successfully')) {
      console.log(combined);
      console.log('✅ D1 migrations applied');
    } else {
      console.error('❌ Failed to apply D1 migrations');
      console.error(combined);
      process.exit(1);
    }
  }
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
