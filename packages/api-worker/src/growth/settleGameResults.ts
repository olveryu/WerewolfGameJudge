/**
 * settleGameResults — 有效局结算（D1 写入）
 *
 * endNight() 广播后异步调用，不阻塞客户端。
 * 有效局条件：status === Ended && ≥9 个不同真人玩家（含匿名）。
 * XP 仅写入注册用户。匿名玩家仅计入有效局人数。
 * 幂等：user_stats.last_room_code 保证不重复写入。
 * 升级时从 REWARD_POOL 随机抽取一个未解锁奖励。
 */

import { pickRandomReward } from '@werewolf/game-engine/growth/frameUnlock';
import { getLevel } from '@werewolf/game-engine/growth/level';
import { rollXp } from '@werewolf/game-engine/growth/level';
import type { RewardItem } from '@werewolf/game-engine/growth/rewardCatalog';
import type { GameState } from '@werewolf/game-engine/protocol/types';

const MIN_PLAYERS = 9;

interface SettlementEnv {
  DB: D1Database;
}

/** 单个玩家的结算结果 */
export interface PlayerSettleResult {
  uid: string;
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  reward?: RewardItem;
}

/** crypto-safe random int in [0, max) */
function cryptoRandomInt(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

/**
 * 结算一局游戏的成长数据。
 *
 * @returns 每个注册玩家的结算结果（空数组 = 不满足有效局条件）
 */
export async function settleGameResults(
  state: GameState,
  env: SettlementEnv,
): Promise<PlayerSettleResult[]> {
  // 1. 收集非空、非 bot 玩家 uid
  const uniqueUids = new Set<string>();
  for (const [, player] of Object.entries(state.players)) {
    if (!player || player.isBot || !player.role) continue;
    uniqueUids.add(player.uid);
  }

  if (uniqueUids.size < MIN_PLAYERS) return [];

  // 2. 查 D1 过滤匿名用户
  const uidList = [...uniqueUids];
  const placeholders = uidList.map(() => '?').join(',');
  const { results: registeredRows } = await env.DB.prepare(
    `SELECT id FROM users WHERE id IN (${placeholders}) AND is_anonymous = 0`,
  )
    .bind(...uidList)
    .all<{ id: string }>();

  const registeredUids = new Set(registeredRows.map((r) => r.id));
  if (registeredUids.size === 0) return [];

  // 3. 遍历注册玩家，结算 XP + 随机解锁
  const results: PlayerSettleResult[] = [];

  for (const uid of registeredUids) {
    const xpEarned = rollXp();

    // Idempotent upsert: WHERE clause ensures duplicate room_code is a no-op (changes === 0)
    // 7 bind params: uid, xpEarned, roomCode (INSERT), xpEarned, roomCode, roomCode (UPDATE WHERE)
    const { meta } = await env.DB.prepare(
      `INSERT INTO user_stats (user_id, xp, level, games_played, last_room_code, updated_at)
       VALUES (?, ?, 0, 1, ?, datetime('now'))
       ON CONFLICT (user_id) DO UPDATE SET
         xp = user_stats.xp + ?,
         games_played = user_stats.games_played + 1,
         last_room_code = ?,
         updated_at = datetime('now')
       WHERE user_stats.last_room_code IS NULL
          OR user_stats.last_room_code != ?`,
    )
      .bind(uid, xpEarned, state.roomCode, xpEarned, state.roomCode, state.roomCode)
      .run();

    // If no rows changed (already settled for this room), skip
    if (meta.changes === 0) continue;

    // Read back actual xp, level, unlocked_items
    const statsRow = await env.DB.prepare(
      `SELECT xp, level, unlocked_items FROM user_stats WHERE user_id = ?`,
    )
      .bind(uid)
      .first<{ xp: number; level: number; unlocked_items: string }>();

    if (statsRow) {
      const previousLevel = statsRow.level;
      const newLevel = getLevel(statsRow.xp);

      let reward: RewardItem | undefined;

      if (newLevel > previousLevel) {
        // Parse existing unlocked items
        const unlockedIds: string[] = JSON.parse(statsRow.unlocked_items) as string[];
        const unlockedSet = new Set(unlockedIds);

        // Pick random reward for each level gained (normally 1)
        for (let lv = previousLevel + 1; lv <= newLevel; lv++) {
          const picked = pickRandomReward(unlockedSet, cryptoRandomInt, lv);
          if (picked) {
            unlockedSet.add(picked.id);
            // Only report the last reward in the settle message (typically 1 level per game)
            reward = picked;
          }
        }

        // Write back level + unlocked_items
        // 3 bind params: newLevel, JSON array, uid
        const updatedItems = JSON.stringify([...unlockedSet]);
        await env.DB.prepare(
          `UPDATE user_stats SET level = ?, unlocked_items = ? WHERE user_id = ?`,
        )
          .bind(newLevel, updatedItems, uid)
          .run();
      }

      results.push({
        uid,
        xpEarned,
        newXp: statsRow.xp,
        newLevel,
        previousLevel,
        reward,
      });
    }
  }

  return results;
}
