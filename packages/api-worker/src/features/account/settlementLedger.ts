/**
 * Shared write base for the two settlement paths (AU-43).
 *
 * settleGameRewards (six games + Werewolf MVP) and the Werewolf
 * settleGameResults own different identity models — a claims-table row whose
 * conflicting replay poisons the input, versus a participant fingerprint
 * verified on read-back — so claim, result insertion, and read-back stay with
 * each path. What is identical is the ledger write shape both paths commit:
 * the level-from-XP CASE expression, the user_stats upsert that applies a
 * settled result row exactly once, and the stats_applied mark. Those live
 * here so the two paths cannot drift apart.
 */

import { LEVEL_PROGRESSION_SEGMENTS } from '@game-judge/game-engine/product/growth';

/** SQL CASE fragment mapping a `new_xp` column value to its level. */
export const LEVEL_FROM_NEW_XP_SQL = LEVEL_PROGRESSION_SEGMENTS.map((segment, index) => {
  const next = LEVEL_PROGRESSION_SEGMENTS[index + 1];
  const expression = `${segment.startingLevel} + CAST((new_xp - ${segment.startingXp}) / ${segment.xpPerLevel} AS INTEGER)`;
  return next === undefined
    ? `ELSE ${expression}`
    : `WHEN new_xp < ${next.startingXp} THEN ${expression}`;
}).join(' ');

interface SettlementLedgerWriteOptions {
  readonly resultsTable: 'product_game_reward_results' | 'game_settlement_results';
  readonly keyColumn: 'settlement_id' | 'effect_id';
  readonly settlementKey: string;
  readonly userId: string;
}

/** Source row shared by reward balances and game-owned cumulative statistics. */
const UNAPPLIED_PRODUCT_REWARD_SQL =
  'SELECT 1 FROM product_game_reward_results WHERE settlement_id = ?1 AND user_id = ?2 AND stats_applied = 0 AND EXISTS (SELECT 1 FROM product_game_reward_claims WHERE id = ?1 AND is_settled = 0)';

/**
 * Increment a game-owned cumulative row only while its reward result is unapplied.
 * Column and table names are static, game-owned SQL identifiers, never request input.
 */
export function createGameStatsStatement(
  db: D1Database,
  settlementId: string,
  userId: string,
  table: string,
  key: Readonly<Record<string, string>>,
  increments: Readonly<Record<string, number>>,
): D1PreparedStatement {
  const keys = Object.keys(key);
  const columns = Object.keys(increments);
  const values = [...Object.values(key), ...Object.values(increments)];
  const placeholders = values.map((_, index) => `?${index + 3}`);
  const updates = columns.map((column) => `${column} = ${table}.${column} + excluded.${column}`);
  return db
    .prepare(
      `INSERT INTO ${table} (user_id, ${[...keys, ...columns].join(', ')})
       SELECT ?2, ${placeholders.join(', ')} WHERE EXISTS (${UNAPPLIED_PRODUCT_REWARD_SQL})
       ON CONFLICT (user_id${keys.map((column) => `, ${column}`).join('')})
       DO UPDATE SET ${updates.join(', ')}`,
    )
    .bind(settlementId, userId, ...values);
}

/**
 * Upsert user_stats from one unapplied result row. `gamesPlayedSql` is the
 * games_played value expression in the source row's terms; `trackSettledAt`
 * selects the Werewolf shape, whose user_stats rows also carry settled_at.
 */
export function createApplyStatsStatement(
  db: D1Database,
  options: SettlementLedgerWriteOptions & {
    readonly gamesPlayedSql: string;
    readonly trackSettledAt: boolean;
  },
): D1PreparedStatement {
  const settledAtColumn = options.trackSettledAt ? ', settled_at' : '';
  const settledAtValue = options.trackSettledAt ? ', settled_at' : '';
  const updatedAtValue = options.trackSettledAt ? 'settled_at' : "datetime('now')";
  const settledAtUpdate = options.trackSettledAt ? 'settled_at = excluded.settled_at, ' : '';
  const unsettledClaim =
    options.resultsTable === 'product_game_reward_results'
      ? ' AND EXISTS (SELECT 1 FROM product_game_reward_claims WHERE id = ?1 AND is_settled = 0)'
      : '';
  return db
    .prepare(
      `
    INSERT INTO user_stats (user_id, xp, level, games_played, normal_draws, golden_draws${settledAtColumn}, updated_at)
    SELECT user_id, new_xp, new_level, ${options.gamesPlayedSql},
      normal_draws_earned, golden_draws_earned${settledAtValue}, ${updatedAtValue}
    FROM ${options.resultsTable} WHERE ${options.keyColumn} = ?1 AND user_id = ?2 AND stats_applied = 0${unsettledClaim}
    ON CONFLICT (user_id) DO UPDATE SET
      xp = excluded.xp, level = excluded.level,
      games_played = user_stats.games_played + excluded.games_played,
      normal_draws = user_stats.normal_draws + excluded.normal_draws,
      golden_draws = user_stats.golden_draws + excluded.golden_draws,
      version = user_stats.version + 1, ${settledAtUpdate}updated_at = excluded.updated_at
  `,
    )
    .bind(options.settlementKey, options.userId);
}

/** Mark one result row's stats as applied; `onlyUnapplied` guards the update. */
export function createMarkStatsAppliedStatement(
  db: D1Database,
  options: SettlementLedgerWriteOptions & { readonly onlyUnapplied: boolean },
): D1PreparedStatement {
  const guard = options.onlyUnapplied ? ' AND stats_applied = 0' : '';
  const unsettledClaim =
    options.resultsTable === 'product_game_reward_results'
      ? ' AND EXISTS (SELECT 1 FROM product_game_reward_claims WHERE id = ?1 AND is_settled = 0)'
      : '';
  return db
    .prepare(
      `UPDATE ${options.resultsTable} SET stats_applied = 1 WHERE ${options.keyColumn} = ?1 AND user_id = ?2${guard}${unsettledClaim}`,
    )
    .bind(options.settlementKey, options.userId);
}
