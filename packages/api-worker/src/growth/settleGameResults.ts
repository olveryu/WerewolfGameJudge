/**
 * settleGameResults — 有效局结算（D1 写入）
 *
 * endNight() 广播后异步调用，不阻塞客户端。
 * 有效局条件：status === Ended && ≥9 个不同注册用户。
 * 幂等：game_results 唯一索引 (room_code, user_id) 保证不重复写入。
 */

import { getLevel } from '@werewolf/game-engine/growth/level';
import { rollMoonPhase } from '@werewolf/game-engine/growth/moonPhase';
import { Faction, getRoleSpec, type RoleId } from '@werewolf/game-engine/models/roles';
import type { GameState } from '@werewolf/game-engine/protocol/types';

const MIN_REGISTERED_USERS = 9;

interface SettlementEnv {
  DB: D1Database;
}

/**
 * 结算一局游戏的成长数据。
 *
 * @returns 写入的玩家数（0 表示不满足有效局条件）
 */
export async function settleGameResults(state: GameState, env: SettlementEnv): Promise<number> {
  // 1. 收集非空、非 bot 玩家 uid
  const playerEntries: Array<{
    uid: string;
    role: RoleId;
    seatNumber: number;
  }> = [];

  for (const [, player] of Object.entries(state.players)) {
    if (!player || player.isBot || !player.role) continue;
    playerEntries.push({
      uid: player.uid,
      role: player.role as RoleId,
      seatNumber: player.seatNumber,
    });
  }

  // 去重 uid
  const uniqueUids = new Set(playerEntries.map((p) => p.uid));
  if (uniqueUids.size === 0) return 0;

  // 2. 查 D1 过滤匿名用户
  const placeholders = [...uniqueUids].map(() => '?').join(',');
  const { results: registeredRows } = await env.DB.prepare(
    `SELECT id FROM users WHERE id IN (${placeholders}) AND is_anonymous = 0`,
  )
    .bind(...uniqueUids)
    .all<{ id: string }>();

  const registeredUids = new Set(registeredRows.map((r) => r.id));
  if (registeredUids.size < MIN_REGISTERED_USERS) return 0;

  // 3. 遍历注册玩家，写入结算数据
  const playerCount = playerEntries.length;
  let settled = 0;

  for (const entry of playerEntries) {
    if (!registeredUids.has(entry.uid)) continue;

    const moonPhase = rollMoonPhase();
    const roleSpec = getRoleSpec(entry.role);
    const faction = roleSpec?.faction ?? Faction.Villager;
    const isHost = entry.uid === state.hostUid ? 1 : 0;
    const gameResultId = `${state.roomCode}_${entry.uid}`;

    // Batch: game_results + user_role_collection + user_stats (upsert)
    await env.DB.batch([
      // game_results (幂等: ON CONFLICT DO NOTHING)
      env.DB.prepare(
        `INSERT INTO game_results (id, room_code, user_id, role_id, faction, is_host, player_count, moon_phase, xp_earned, template_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (room_code, user_id) DO NOTHING`,
      ).bind(
        gameResultId,
        state.roomCode,
        entry.uid,
        entry.role,
        faction,
        isHost,
        playerCount,
        moonPhase.id,
        moonPhase.xp,
        null,
      ),

      // user_role_collection (幂等: ON CONFLICT DO NOTHING)
      env.DB.prepare(
        `INSERT INTO user_role_collection (user_id, role_id)
         VALUES (?, ?)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
      ).bind(entry.uid, entry.role),

      // user_stats upsert: xp + games_played only (level computed after)
      env.DB.prepare(
        `INSERT INTO user_stats (user_id, xp, level, games_played, updated_at)
         VALUES (?, ?, 0, 1, datetime('now'))
         ON CONFLICT (user_id) DO UPDATE SET
           xp = user_stats.xp + ?,
           games_played = user_stats.games_played + 1,
           updated_at = datetime('now')`,
      ).bind(entry.uid, moonPhase.xp, moonPhase.xp),
    ]);

    // Compute correct level from actual xp total and update
    const statsRow = await env.DB.prepare(`SELECT xp FROM user_stats WHERE user_id = ?`)
      .bind(entry.uid)
      .first<{ xp: number }>();

    if (statsRow) {
      const newLevel = getLevel(statsRow.xp);
      await env.DB.prepare(`UPDATE user_stats SET level = ? WHERE user_id = ?`)
        .bind(newLevel, entry.uid)
        .run();
    }

    settled++;
  }

  return settled;
}
