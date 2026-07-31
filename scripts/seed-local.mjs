#!/usr/bin/env node
/**
 * seed-local — 本地 D1 dev 用户 seed 脚本
 *
 * 通过 TypeScript AST 读取 product/rewards/catalog.ts 的奖励 ID 数组，
 * 创建确定性 dev 用户（全解锁），通过 wrangler d1 execute --local 写入。
 *
 * 用法：node scripts/seed-local.mjs
 * 或：  pnpm -F @game-judge/api-worker db:seed:local
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Dev 用户常量 ────────────────────────────────────────────────────────────

const DEV_USER_ID = '00000000-0000-4000-a000-000000000001';
const DEV_EMAIL = 'dev@test.local';
const DEV_DISPLAY_NAME = 'Dev User';
// PBKDF2-SHA256 hash of 'dev123' (deterministic salt)
const DEV_PASSWORD_HASH =
  '$pbkdf2-sha256$100000$ZGV2LXNlZWQtc2FsdC12MQ==$cKKdQtBQTaxbYFeIHkbrRnXHGwbklZK6/yuT7p91XE8=';

// ── 从 catalog.ts 解析 ID 数组 ─────────────────────────────────────────────

const catalogPath = resolve(__dirname, '../packages/game-engine/src/product/rewards/catalog.ts');
const catalogSrc = readFileSync(catalogPath, 'utf-8');
const catalogSourceFile = ts.createSourceFile(
  catalogPath,
  catalogSrc,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

function unwrapExpression(expression) {
  let current = expression;
  while (ts.isAsExpression(current) || ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

const catalogArrays = new Map();
for (const statement of catalogSourceFile.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue;
    const initializer = unwrapExpression(declaration.initializer);
    if (ts.isArrayLiteralExpression(initializer)) {
      catalogArrays.set(declaration.name.text, initializer);
    }
  }
}

/** 从 AST 中提取字符串数组（支持 `...VAR_NAME` spread 引用）。 */
function extractIds(varName, ancestors = []) {
  if (ancestors.includes(varName)) {
    throw new Error(`Cyclic catalog array spread: ${[...ancestors, varName].join(' -> ')}`);
  }
  const array = catalogArrays.get(varName);
  if (array === undefined) {
    throw new Error(`Cannot find catalog array ${varName}`);
  }

  const ids = [];
  for (const element of array.elements) {
    if (ts.isStringLiteral(element)) {
      ids.push(element.text);
      continue;
    }
    if (ts.isSpreadElement(element) && ts.isIdentifier(element.expression)) {
      ids.push(...extractIds(element.expression.text, [...ancestors, varName]));
      continue;
    }
    throw new Error(
      `Unsupported expression in catalog array ${varName}: ${element.getText(catalogSourceFile)}`,
    );
  }
  return ids;
}

const avatarIds = extractIds('AVATAR_IDS');
const frameIds = extractIds('FRAME_IDS');
const flairIds = extractIds('SEAT_FLAIR_IDS');
const nameStyleIds = extractIds('NAME_STYLE_IDS');
const effectIds = extractIds('ROLE_REVEAL_EFFECT_IDS');
const seatAnimationIds = extractIds('SEAT_ANIMATION_IDS');
const allIds = [
  ...avatarIds,
  ...frameIds,
  ...flairIds,
  ...nameStyleIds,
  ...effectIds,
  ...seatAnimationIds,
];
if (new Set(allIds).size !== allIds.length) {
  throw new Error('Reward catalog contains duplicate IDs');
}

console.log(
  `Parsed ${avatarIds.length} avatars, ${frameIds.length} frames, ${flairIds.length} flairs, ${nameStyleIds.length} nameStyles, ${effectIds.length} effects, ${seatAnimationIds.length} seatAnimations (${allIds.length} total)`,
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
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'werewolf-db',
      '--local',
      '--config=wrangler.toml',
      `--file=${tmpSql}`,
    ],
    {
      cwd: workerDir,
      encoding: 'utf-8',
      stdio: 'inherit',
    },
  );
  console.log('\nSeed complete! Login with dev@test.local / dev123');
} catch (e) {
  console.error('Seed failed:', e);
  process.exitCode = 1;
} finally {
  if (existsSync(tmpSql)) {
    unlinkSync(tmpSql);
  }
}
