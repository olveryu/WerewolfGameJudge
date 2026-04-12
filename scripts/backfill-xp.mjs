#!/usr/bin/env node
/**
 * backfill-xp — 一次性脚本：为房间 3094 的 4 名注册用户补发 3 局 XP + 升级奖励
 *
 * 用法：node scripts/backfill-xp.mjs
 *
 * 执行前确认 wrangler 已登录且在 packages/api-worker 目录下可用。
 * 脚本会：
 *   1. 计算每人 180 XP（3局 × 60 avg）→ 新等级
 *   2. 对每个升级调用 pickRandomReward 抽奖
 *   3. 输出 SQL INSERT 语句
 *   4. 通过 wrangler d1 execute 写入 production D1
 */

import { execSync } from 'node:child_process';
import { randomInt } from 'node:crypto';

// ── 内联 game-engine 逻辑（避免 ESM/CJS 兼容问题） ─────────────────────────

const LEVEL_THRESHOLDS = [0];
for (let lv = 1; lv <= 51; lv++) {
  const delta = lv <= 20 ? 60 : lv <= 40 ? 90 : 120;
  LEVEL_THRESHOLDS.push(LEVEL_THRESHOLDS[lv - 1] + delta);
}

function getLevel(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

// AVATAR_IDS (42) — free: villager
const AVATAR_IDS = [
  'avenger',
  'awakenedGargoyle',
  'bloodMoon',
  'crow',
  'cursedFox',
  'cupid',
  'dancer',
  'darkWolfKing',
  'dreamcatcher',
  'drunkSeer',
  'gargoyle',
  'graveyardKeeper',
  'guard',
  'hunter',
  'idiot',
  'knight',
  'magician',
  'maskedMan',
  'masquerade',
  'mirrorSeer',
  'nightmare',
  'piper',
  'poisoner',
  'psychic',
  'pureWhite',
  'seer',
  'shadow',
  'silenceElder',
  'slacker',
  'spiritKnight',
  'thief',
  'treasureMaster',
  'villager',
  'votebanElder',
  'warden',
  'wildChild',
  'witch',
  'witcher',
  'wolf',
  'wolfKing',
  'wolfQueen',
  'wolfRobot',
  'wolfWitch',
];

// FRAME_IDS (10) — no free
const FRAME_IDS = [
  'ironForge',
  'moonSilver',
  'bloodThorn',
  'runicSeal',
  'boneGate',
  'hellFire',
  'darkVine',
  'frostCrystal',
  'pharaohGold',
  'voidRift',
];

// SEAT_FLAIR_IDS (10) — no free
const SEAT_FLAIR_IDS = [
  'emberGlow',
  'frostAura',
  'shadowMist',
  'goldenShine',
  'bloodMark',
  'starlight',
  'thunderBolt',
  'sakura',
  'runeCircle',
  'fireRing',
];

const FREE_AVATAR_IDS = new Set(['villager']);

const REWARD_POOL = [
  ...AVATAR_IDS.filter((id) => !FREE_AVATAR_IDS.has(id)).map((id) => ({ type: 'avatar', id })),
  ...FRAME_IDS.map((id) => ({ type: 'frame', id })),
  ...SEAT_FLAIR_IDS.map((id) => ({ type: 'seatFlair', id })),
];

function pickRandomReward(unlockedIds, level) {
  const preferredType = level % 5 === 0 ? 'frame' : level % 3 === 0 ? 'seatFlair' : 'avatar';
  const preferred = REWARD_POOL.filter(
    (item) => item.type === preferredType && !unlockedIds.has(item.id),
  );
  if (preferred.length > 0) return preferred[randomInt(preferred.length)];

  const fallback = REWARD_POOL.filter((item) => !unlockedIds.has(item.id));
  if (fallback.length === 0) return undefined;
  return fallback[randomInt(fallback.length)];
}

// ── 补发配置 ────────────────────────────────────────────────────────────────

const XP_TO_ADD = 180; // 3 games × 60 avg
const GAMES_TO_ADD = 3;

const USERS = [
  { uid: 'fd5e17a8-8130-4186-b18d-084e2618d05b', name: '小笼包' },
  { uid: '3c447a0b-42ec-499e-afab-a027dbfa4c1a', name: 'Ypp' },
  { uid: 'd0392e4c-8258-499c-a51c-31cab566f013', name: '给我预言家' },
  { uid: '03536af1-e886-47ed-be3c-5953696408b5', name: 'hzh' },
];

// ── 计算 ────────────────────────────────────────────────────────────────────

console.log('=== Backfill XP for room 3094 ===\n');

const sqlStatements = [];

for (const user of USERS) {
  const oldXp = 0;
  const newXp = oldXp + XP_TO_ADD;
  const oldLevel = getLevel(oldXp);
  const newLevel = getLevel(newXp);

  const unlockedIds = new Set();
  const rewards = [];

  for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
    const reward = pickRandomReward(unlockedIds, lv);
    if (reward) {
      unlockedIds.add(reward.id);
      rewards.push(reward);
    }
  }

  const unlockedItems = JSON.stringify([...unlockedIds]);

  console.log(`${user.name} (${user.uid.slice(0, 8)}...):`);
  console.log(`  XP: ${oldXp} → ${newXp}, Level: ${oldLevel} → ${newLevel}`);
  console.log(`  Rewards (${rewards.length}):`);
  for (const r of rewards) {
    console.log(`    Lv.${rewards.indexOf(r) + 1}: [${r.type}] ${r.id}`);
  }
  console.log();

  // INSERT OR REPLACE since user_stats is empty
  const sql = `INSERT INTO user_stats (user_id, xp, level, games_played, unlocked_items, updated_at) VALUES ('${user.uid}', ${newXp}, ${newLevel}, ${GAMES_TO_ADD}, '${unlockedItems}', datetime('now'));`;
  sqlStatements.push(sql);
}

// ── 执行 ────────────────────────────────────────────────────────────────────

const combinedSql = sqlStatements.join(' ');
console.log('=== SQL to execute ===');
console.log(combinedSql);
console.log();

const proceed = process.argv.includes('--execute');
if (!proceed) {
  console.log('Dry run complete. Add --execute to write to production D1.');
  process.exit(0);
}

console.log('Executing on remote D1...');
try {
  const result = execSync(
    `npx wrangler d1 execute werewolf-db --remote --command="${combinedSql.replace(/"/g, '\\"')}"`,
    { cwd: 'packages/api-worker', encoding: 'utf-8', stdio: 'pipe' },
  );
  console.log(result);
  console.log('Done!');
} catch (e) {
  console.error('Failed:', e.stderr || e.message);
  process.exit(1);
}
