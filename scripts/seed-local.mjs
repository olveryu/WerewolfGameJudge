#!/usr/bin/env node
/**
 * seed-local — 本地 D1 dev 用户 seed 脚本
 *
 * 读取 rewardCatalog.ts 的 AVATAR_IDS / FRAME_IDS / SEAT_FLAIR_IDS，
 * 创建确定性 dev 用户（全解锁），通过 wrangler d1 execute --local 写入。
 *
 * 用法：node scripts/seed-local.mjs
 * 或：  pnpm -F @werewolf/api-worker db:seed:local
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Dev 用户常量 ────────────────────────────────────────────────────────────

const DEV_USER_ID = '00000000-0000-4000-a000-000000000001';
const DEV_EMAIL = 'dev@test.local';
const DEV_DISPLAY_NAME = 'Dev User';
// PBKDF2-SHA256 hash of 'dev123' (deterministic salt)
const DEV_PASSWORD_HASH =
  '$pbkdf2-sha256$100000$ZGV2LXNlZWQtc2FsdC12MQ==$cKKdQtBQTaxbYFeIHkbrRnXHGwbklZK6/yuT7p91XE8=';

// ── 从 rewardCatalog.ts 解析 ID 数组 ───────────────────────────────────────

const catalogPath = resolve(__dirname, '../packages/game-engine/src/growth/rewardCatalog.ts');
const catalogSrc = readFileSync(catalogPath, 'utf-8');

/** 从 TS 源码中提取数组元素（支持 `...VAR_NAME` spread 引用） */
function extractIds(source, varName) {
  // Match both `export const` and plain `const`
  const re = new RegExp(
    `(?:export\\s+)?const\\s+${varName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`,
  );
  const match = source.match(re);
  if (!match) throw new Error(`Cannot find ${varName} in rewardCatalog.ts`);
  const body = match[1];
  const ids = [];
  // Collect inline string literals
  for (const m of body.matchAll(/'([^']+)'/g)) ids.push(m[1]);
  // Resolve spread references: ...SOME_VAR
  for (const m of body.matchAll(/\.\.\.(\w+)/g)) ids.push(...extractIds(source, m[1]));
  return ids;
}

const avatarIds = extractIds(catalogSrc, 'AVATAR_IDS');
const frameIds = extractIds(catalogSrc, 'FRAME_IDS');
const flairIds = extractIds(catalogSrc, 'SEAT_FLAIR_IDS');
const nameStyleIds = extractIds(catalogSrc, 'NAME_STYLE_IDS');
const effectIds = extractIds(catalogSrc, 'ROLE_REVEAL_EFFECT_IDS');
const allIds = [...avatarIds, ...frameIds, ...flairIds, ...nameStyleIds, ...effectIds];

console.log(
  `Parsed ${avatarIds.length} avatars, ${frameIds.length} frames, ${flairIds.length} flairs, ${nameStyleIds.length} nameStyles, ${effectIds.length} effects (${allIds.length} total)`,
);

// ── 生成 SQL ────────────────────────────────────────────────────────────────

const unlockedJson = JSON.stringify(allIds);
const maxLevel = 99;
const maxXp = 9999;

const sql = [
  // Dev user (INSERT OR REPLACE to be idempotent)
  `INSERT OR REPLACE INTO users (id, email, password_hash, display_name, is_anonymous, created_at, updated_at) VALUES ('${DEV_USER_ID}', '${DEV_EMAIL}', '${DEV_PASSWORD_HASH}', '${DEV_DISPLAY_NAME}', 0, datetime('now'), datetime('now'));`,
  // Full-unlock user_stats with gacha tickets for testing
  `INSERT OR REPLACE INTO user_stats (user_id, xp, level, games_played, unlocked_items, normal_draws, golden_draws, normal_pity, golden_pity, version, last_login_reward_at, updated_at) VALUES ('${DEV_USER_ID}', ${maxXp}, ${maxLevel}, 100, '${unlockedJson}', 50, 10, 0, 0, 0, NULL, datetime('now'));`,
].join(' ');

console.log('\n=== Dev user seed ===');
console.log(`  Email:    ${DEV_EMAIL}`);
console.log(`  Password: dev123`);
console.log(`  UUID:     ${DEV_USER_ID}`);
console.log(`  Level:    ${maxLevel} (XP: ${maxXp})`);
console.log(`  Unlocked: ${allIds.length} items\n`);

// ── 执行 ────────────────────────────────────────────────────────────────────

const workerDir = resolve(__dirname, '../packages/api-worker');
const tmpSql = join(workerDir, '.seed-local-tmp.sql');

try {
  // Write SQL to temp file to avoid shell $ expansion mangling the password hash
  writeFileSync(tmpSql, sql, 'utf-8');
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'werewolf-db', '--local', `--file=${tmpSql}`], {
    cwd: workerDir,
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  console.log('\nSeed complete! Login with dev@test.local / dev123');
} catch (e) {
  console.error('Seed failed:', e.message);
  process.exit(1);
} finally {
  try {
    unlinkSync(tmpSql);
  } catch {
    // ignore cleanup errors
  }
}
