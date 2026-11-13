/** Werewolf-owned D1 table definitions imported directly by Werewolf persistence. */

import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/** Per-game camp history used by Werewolf public statistics. */
export const campSettlements = sqliteTable(
  'camp_settlements',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Game-ended effect ID; shared with game_settlement_results.effect_id. */
    settleKey: text('settle_key').notNull(),
    /** Camp bucket: 'wolf' | 'god' | 'villager' | 'third' (CampBucket). */
    camp: text('camp').notNull(),
    /** ISO 8601 UTC; drives the two-hour public visibility delay. */
    settledAt: text('settled_at').notNull(),
    isAggregated: integer('is_aggregated').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.settleKey] }),
    index('idx_camp_pending_user')
      .on(table.userId, sql`datetime(${table.settledAt})`, table.camp)
      .where(sql`${table.isAggregated} = 0`),
    index('idx_camp_pending_due')
      .on(sql`datetime(${table.settledAt})`, table.userId, table.settleKey)
      .where(sql`${table.isAggregated} = 0`),
    check(
      'camp_settlements_valid_row',
      sql`${table.isAggregated} IN (0, 1) AND ${table.camp} IN ('wolf', 'god', 'villager', 'third') AND datetime(${table.settledAt}) IS NOT NULL`,
    ),
  ],
);

/** Public camp counts whose original settlement records have been atomically aggregated. */
export const werewolfUserCampStats = sqliteTable(
  'werewolf_user_camp_stats',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    wolfCount: integer('wolf_count').notNull().default(0),
    godCount: integer('god_count').notNull().default(0),
    villagerCount: integer('villager_count').notNull().default(0),
    thirdCount: integer('third_count').notNull().default(0),
  },
  (table) => [
    check(
      'werewolf_camp_counts_nonnegative',
      sql`${table.wolfCount} >= 0 AND ${table.godCount} >= 0 AND ${table.villagerCount} >= 0 AND ${table.thirdCount} >= 0`,
    ),
  ],
);

/** Exact per-player rewards committed for an at-least-once Werewolf ended effect. */
export const gameSettlementResults = sqliteTable(
  'game_settlement_results',
  {
    effectId: text('effect_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roomCode: text('room_code').notNull(),
    participantFingerprint: text('participant_fingerprint').notNull(),
    camp: text('camp').notNull(),
    previousXp: integer('previous_xp').notNull(),
    xpEarned: integer('xp_earned').notNull(),
    newXp: integer('new_xp').notNull(),
    previousLevel: integer('previous_level').notNull(),
    newLevel: integer('new_level').notNull(),
    normalDrawsEarned: integer('normal_draws_earned').notNull(),
    goldenDrawsEarned: integer('golden_draws_earned').notNull(),
    statsApplied: integer('stats_applied').notNull().default(0),
    settledAt: text('settled_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.effectId, table.userId] }),
    index('idx_game_settlement_results_user_settled').on(table.userId, table.settledAt),
  ],
);
