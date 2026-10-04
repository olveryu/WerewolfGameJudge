#!/usr/bin/env node
// Debug 0062 hang: split into statements, time each one.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerDir = join(__dirname, '..', 'packages', 'api-worker');
const sql = readFileSync(join(workerDir, 'migrations', '0062_drawguess.sql'), 'utf-8');

// Split by semicolon, filter empty
const statements = sql
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`Total statements: ${statements.length}`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
  console.log(`\n[${i + 1}/${statements.length}] ${preview}...`);
  const start = Date.now();
  try {
    execSync(
      `pnpm exec wrangler d1 execute werewolf-db --local --config wrangler.toml --command ${JSON.stringify(stmt)}`,
      { cwd: workerDir, stdio: 'pipe', timeout: 30000 },
    );
    const elapsed = Date.now() - start;
    console.log(`  ✅ ${elapsed}ms`);
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`  ❌ ${elapsed}ms: ${err.message.substring(0, 200)}`);
    process.exit(1);
  }
}
console.log('\nAll statements completed');
