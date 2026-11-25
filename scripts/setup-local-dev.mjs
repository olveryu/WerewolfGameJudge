#!/usr/bin/env node
/**
 * Initialize this worktree's local D1 before either development server starts.
 * Reruns are safe: Wrangler journals migrations and the seed only inserts missing data.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workerDir = fileURLToPath(new URL('../packages/api-worker/', import.meta.url));

for (const script of ['db:migrate:local', 'db:seed:local']) {
  console.log(`Local D1 initialization: ${script}`);
  try {
    execFileSync('pnpm', ['run', script], {
      cwd: workerDir,
      stdio: ['ignore', 'inherit', 'inherit'],
      timeout: 5 * 60 * 1000,
    });
  } catch (error) {
    console.error(`Local D1 initialization failed at ${script}; servers were not started.`, error);
    process.exit(1);
  }
}
