/**
 * settleGameResults — 有效局结算（D1 写入）
 *
 * audioAck() 确认音频播完后异步调用，不阻塞客户端。
 * 有效局条件：status === Ended && ≥9 个不同真人玩家（含匿名）。
 * XP 仅写入注册用户。匿名玩家仅计入有效局人数。
 * 幂等：user_stats.last_room_code 保证不重复写入。
 * 每局获得 2 张普通抽奖券；升级额外获得 2 张黄金抽奖券。
 */

import { getLevel } from '@werewolf/game-engine/growth/level';
import { rollXp } from '@werewolf/game-engine/growth/level';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { createDb } from '../db';
import { users, userStats } from '../db/schema';

const MIN_PLAYERS = 6;

/** 每局获得的普通抽奖券 */
const NORMAL_DRAWS_PER_GAME = 2;
/** 升级额外获得的黄金抽奖券 */
const GOLDEN_DRAWS_ON_LEVEL_UP = 2;

interface SettlementEnv {
  DB: D1Database;
}

/** 单个玩家的结算结果 */
export interface PlayerSettleResult {
  userId: string;
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

  // 1. 收集非空、非 bot 玩家 userId
  const uniqueUserIds = new Set<string>();
  for (const [, player] of Object.entries(state.players)) {
    if (!player || player.isBot || !player.role) continue;
    uniqueUserIds.add(player.userId);
  }

  if (uniqueUserIds.size < MIN_PLAYERS) return [];

  // 2. 查 D1 过滤匿名用户
  const userIdList = [...uniqueUserIds];
  const registeredRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, userIdList), eq(users.isAnonymous, 0)));

  const registeredUserIds = new Set(registeredRows.map((r) => r.id));
  if (registeredUserIds.size === 0) return [];

  // 3. 遍历注册玩家，结算 XP + 券
  const results: PlayerSettleResult[] = [];

  for (const userId of registeredUserIds) {
    const xpEarned = rollXp();

    // Read current stats first to compute level transition
    const statsRow = await db
      .select({
        xp: userStats.xp,
        level: userStats.level,
        lastRoomCode: userStats.lastRoomCode,
      })
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .get();

    // Skip if already settled for this game (idempotency)
    if (statsRow && statsRow.lastRoomCode === settleKey) continue;

    const previousLevel = statsRow?.level ?? 0;
    const previousXp = statsRow?.xp ?? 0;
    const newXp = previousXp + xpEarned;
    const newLevel = getLevel(newXp);
    const normalDrawsEarned = NORMAL_DRAWS_PER_GAME;
    const goldenDrawsEarned = newLevel > previousLevel ? GOLDEN_DRAWS_ON_LEVEL_UP : 0;
    const now = new Date().toISOString();

    // Single atomic upsert: XP + level + draws + settleKey + settledAt
    // The setWhere guard ensures this is a no-op on duplicate (race between retries)
    await db
      .insert(userStats)
      .values({
        userId,
        xp: xpEarned,
        level: newLevel,
        gamesPlayed: 1,
        normalDraws: normalDrawsEarned,
        goldenDraws: goldenDrawsEarned,
        lastRoomCode: settleKey,
        settledAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: {
          xp: sql`${userStats.xp} + ${xpEarned}`,
          level: newLevel,
          gamesPlayed: sql`${userStats.gamesPlayed} + 1`,
          normalDraws: sql`${userStats.normalDraws} + ${normalDrawsEarned}`,
          goldenDraws: sql`${userStats.goldenDraws} + ${goldenDrawsEarned}`,
          lastRoomCode: settleKey,
          settledAt: now,
          updatedAt: now,
        },
        setWhere: sql`${userStats.lastRoomCode} IS NULL OR ${userStats.lastRoomCode} != ${settleKey}`,
      });

    results.push({
      userId,
      xpEarned,
      newXp,
      newLevel,
      previousLevel,
      normalDrawsEarned,
      goldenDrawsEarned,
    });
  }

  return results;
}
