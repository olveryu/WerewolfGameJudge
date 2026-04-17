/**
 * settleGameResults — 有效局结算（D1 写入）
 *
 * audioAck() 确认音频播完后异步调用，不阻塞客户端。
 * 有效局条件：status === Ended && ≥9 个不同真人玩家（含匿名）。
 * XP 仅写入注册用户。匿名玩家仅计入有效局人数。
 * 幂等：user_stats.last_room_code 保证不重复写入。
 * 每局获得 1 张普通抽奖券；升级额外获得 1 张黄金抽奖券。
 */

import { getLevel } from '@werewolf/game-engine/growth/level';
import { rollXp } from '@werewolf/game-engine/growth/level';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { createDb } from '../db';
import { users, userStats } from '../db/schema';

const MIN_PLAYERS = 9;

/** 每局获得的普通抽奖券 */
const NORMAL_DRAWS_PER_GAME = 1;
/** 升级额外获得的黄金抽奖券 */
const GOLDEN_DRAWS_ON_LEVEL_UP = 1;

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
  normalDrawsEarned: number;
  goldenDrawsEarned: number;
}

/**
 * 结算一局游戏的成长数据。
 *
 * @returns 每个注册玩家的结算结果（空数组 = 不满足有效局条件）
 */
export async function settleGameResults(
  state: GameState,
  env: SettlementEnv,
  revision: number,
): Promise<PlayerSettleResult[]> {
  // Settle key: roomCode:revision — allows re-settle after same-room restart
  const settleKey = `${state.roomCode}:${revision}`;
  const db = createDb(env.DB);

  // 1. 收集非空、非 bot 玩家 uid
  const uniqueUids = new Set<string>();
  for (const [, player] of Object.entries(state.players)) {
    if (!player || player.isBot || !player.role) continue;
    uniqueUids.add(player.uid);
  }

  if (uniqueUids.size < MIN_PLAYERS) return [];

  // 2. 查 D1 过滤匿名用户
  const uidList = [...uniqueUids];
  const registeredRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, uidList), eq(users.isAnonymous, 0)));

  const registeredUids = new Set(registeredRows.map((r) => r.id));
  if (registeredUids.size === 0) return [];

  // 3. 遍历注册玩家，结算 XP + 随机解锁
  const results: PlayerSettleResult[] = [];

  for (const uid of registeredUids) {
    const xpEarned = rollXp();

    // Idempotent upsert: WHERE clause ensures duplicate settleKey is a no-op (changes === 0)
    await db
      .insert(userStats)
      .values({
        userId: uid,
        xp: xpEarned,
        level: 0,
        gamesPlayed: 1,
        lastRoomCode: settleKey,
        updatedAt: sql`datetime('now')`,
      })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: {
          xp: sql`${userStats.xp} + ${xpEarned}`,
          gamesPlayed: sql`${userStats.gamesPlayed} + 1`,
          lastRoomCode: settleKey,
          updatedAt: sql`datetime('now')`,
        },
        setWhere: sql`${userStats.lastRoomCode} IS NULL OR ${userStats.lastRoomCode} != ${settleKey}`,
      });

    // Read back actual xp, level, unlocked_items
    const statsRow = await db
      .select({
        xp: userStats.xp,
        level: userStats.level,
        unlockedItems: userStats.unlockedItems,
      })
      .from(userStats)
      .where(eq(userStats.userId, uid))
      .get();

    if (statsRow) {
      const previousLevel = statsRow.level;
      const newLevel = getLevel(statsRow.xp);

      const normalDrawsEarned = NORMAL_DRAWS_PER_GAME;
      const goldenDrawsEarned = newLevel > previousLevel ? GOLDEN_DRAWS_ON_LEVEL_UP : 0;

      // Write back level + increment draw tickets
      if (newLevel > previousLevel || normalDrawsEarned > 0 || goldenDrawsEarned > 0) {
        await db
          .update(userStats)
          .set({
            level: newLevel,
            normalDraws: sql`${userStats.normalDraws} + ${normalDrawsEarned}`,
            goldenDraws: sql`${userStats.goldenDraws} + ${goldenDrawsEarned}`,
          })
          .where(eq(userStats.userId, uid));
      }

      results.push({
        uid,
        xpEarned,
        newXp: statsRow.xp,
        newLevel,
        previousLevel,
        normalDrawsEarned,
        goldenDrawsEarned,
      });
    }
  }

  return results;
}
