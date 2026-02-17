/**
 * Shared dev-server configuration utilities.
 *
 * Single source of truth for:
 * - Required env field list
 * - Loading & validating config from env/*.json
 * - Building child process env for vercel dev
 * - Writing managed vars to .env.local
 * - Spawning vercel dev with signal forwarding
 *
 * Consumed by: run-e2e-web.mjs, dev-api.mjs
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// ─── Constants ───────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT_DIR = join(__dirname, '..', '..');

/**
 * All env fields that MUST be present in env/e2e.*.json.
 * Add new fields here — both scripts pick them up automatically.
 */
export const REQUIRED_FIELDS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
];

/**
 * Keys written into .env.local (managed section).
 * Vercel dev / Metro reads these; non-managed lines are preserved.
 */
export const MANAGED_ENV_KEYS = [...REQUIRED_FIELDS];

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

// ─── buildChildEnv ───────────────────────────────────────────────────────────

/**
 * Build environment variables object for the vercel dev child process.
 *
 * Vercel CLI 50.x does NOT inject .env.local into serverless function workers,
 * so we must pass all required vars explicitly.
 *
 * @param {Record<string, string>} config - validated config
 * @param {Record<string, string>} [extra] - additional vars to merge
 * @returns {Record<string, string>}
 */
export function buildChildEnv(config, extra = {}) {
  const env = { ...process.env };

  for (const key of REQUIRED_FIELDS) {
    env[key] = config[key];
  }

  // Force official npm registry (avoids hanging on corporate proxies)
  env.npm_config_registry = 'https://registry.npmjs.org/';

  Object.assign(env, extra);
  return env;
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

// ─── spawnVercelDev ──────────────────────────────────────────────────────────

/**
 * Spawn `vercel dev` with signal forwarding and exit propagation.
 *
 * @param {{ port: string, childEnv: Record<string, string> }} opts
 * @returns {import('node:child_process').ChildProcess}
 */
export function spawnVercelDev({ port, childEnv }) {
  const vercelArgs = ['dev', '--listen', port, '--yes'];

  if (process.env.VERCEL_TOKEN) {
    vercelArgs.push('--token', process.env.VERCEL_TOKEN);
  }

  console.log(`🚀 Starting: vercel ${vercelArgs.join(' ')}\n`);

  const child = spawn('vercel', vercelArgs, {
    cwd: ROOT_DIR,
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

  return child;
}
