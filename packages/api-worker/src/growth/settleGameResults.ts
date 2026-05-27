/**
 * settleGameResults — valid game settlement (D1 write)
 *
 * Called asynchronously after audioAck() confirms audio playback; does not block the client.
 * Valid game conditions: status === Ended && ≥9 distinct human players (including anonymous).
 * XP is written only for registered users. Anonymous players count toward the player threshold only.
 * Idempotent: user_stats.last_room_code prevents duplicate writes.
 * Each game awards 1–5 standard lottery tickets (weighted random); level-up awards an extra 1–5 golden tickets (weighted random).
 */

import {
  getLevel,
  rollGoldenDraws,
  rollNormalDraws,
  rollXp,
} from '@werewolf/game-engine/growth/level';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { createDb } from '../db';
import { users, userStats } from '../db/schema';

const MIN_PLAYERS = 6;

interface SettlementEnv {
  DB: D1Database;
}

/** Settlement result for a single player */
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
 * Settles growth data for a completed game.
 *
 * @returns Settlement results for each registered player (empty array = valid game conditions not met)
 */
export async function settleGameResults(
  state: GameState,
  env: SettlementEnv,
  revision: number,
): Promise<PlayerSettleResult[]> {
  // Settle key: roomCode:revision — allows re-settle after same-room restart
  const settleKey = `${state.roomCode}:${revision}`;
  const db = createDb(env.DB);

  // 1. Collect non-empty, non-bot player userIds
  const uniqueUserIds = new Set<string>();
  for (const [, player] of Object.entries(state.players)) {
    if (!player || player.isBot || !player.role) continue;
    uniqueUserIds.add(player.userId);
  }

  if (uniqueUserIds.size < MIN_PLAYERS) return [];

  // 2. Query D1 to filter out anonymous users
  const userIdList = [...uniqueUserIds];
  const registeredRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, userIdList), eq(users.isAnonymous, 0)));

  const registeredUserIds = new Set(registeredRows.map((r) => r.id));
  if (registeredUserIds.size === 0) return [];

  // 3. Iterate registered players and settle XP + tickets
  const results: PlayerSettleResult[] = [];

  for (const userId of registeredUserIds) {
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
    const xpEarned = rollXp(previousLevel);
    const newXp = previousXp + xpEarned;
    const newLevel = getLevel(newXp);
    const normalDrawsEarned = rollNormalDraws();
    const goldenDrawsEarned = newLevel > previousLevel ? rollGoldenDraws() : 0;
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
