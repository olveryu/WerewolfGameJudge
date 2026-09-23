/** Product reward ledger: one atomic D1 batch, immutable replay, and shared account balances. */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { createSeededRng } from '@game-judge/game-engine/platform/random';
import { getLevel, LEVEL_PROGRESSION_SEGMENTS } from '@game-judge/game-engine/product/growth';
import {
  DAILY_COMPLETION_GOLDEN_DRAWS,
  GAME_COMPLETION_REWARDS,
  getMvpGoldenDraws,
  rollGoldenDraws,
} from '@game-judge/game-engine/product/rewards';
import { z } from 'zod';

import type { Env } from '../../env';
import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';

export const gameCompletionPayloadSchema = z.strictObject({
  roundId: z.string().min(1),
  completedAt: z.number().int().nonnegative(),
  participantUserIds: z.array(z.string().min(1)).readonly(),
});

interface RewardIdentity {
  readonly settlementId: string;
  readonly completedAt: number;
  readonly participantUserIds: readonly string[];
}

type GameRewardPolicy =
  | { readonly kind: 'completion'; readonly gameType: keyof typeof GAME_COMPLETION_REWARDS }
  | { readonly kind: 'mvp'; readonly gameType: 'werewolf'; readonly humanPlayerCount: number };

export type GameRewardInput = RewardIdentity & GameRewardPolicy;

const rewardResultSchema = z.strictObject({
  userId: z.string().min(1),
  xpEarned: z.number().int().nonnegative(),
  newXp: z.number().int().nonnegative(),
  previousLevel: z.number().int().nonnegative(),
  newLevel: z.number().int().nonnegative(),
  normalDrawsEarned: z.number().int().nonnegative(),
  goldenDrawsEarned: z.number().int().nonnegative(),
  statsApplied: z.literal(1),
});

const levelSql = LEVEL_PROGRESSION_SEGMENTS.map((segment, index) => {
  const next = LEVEL_PROGRESSION_SEGMENTS[index + 1];
  const expression = `${segment.startingLevel} + CAST((new_xp - ${segment.startingXp}) / ${segment.xpPerLevel} AS INTEGER)`;
  return next === undefined
    ? `ELSE ${expression}`
    : `WHEN new_xp < ${next.startingXp} THEN ${expression}`;
}).join(' ');

function insertResult(db: D1Database, input: GameRewardInput, userId: string): D1PreparedStatement {
  const policy = input.kind === 'completion' ? GAME_COMPLETION_REWARDS[input.gameType] : null;
  const goldenCandidate = rollGoldenDraws(
    createSeededRng(canonicalJson([input.settlementId, userId, 'goldenDraws'])),
  );
  const mvpDraws = input.kind === 'mvp' ? getMvpGoldenDraws(input.humanPlayerCount) : 0;
  return db
    .prepare(
      `
    WITH current_stats AS (
      SELECT COALESCE((SELECT xp FROM user_stats WHERE user_id = ?2), 0) AS previous_xp,
        COALESCE((SELECT level FROM user_stats WHERE user_id = ?2), 0) AS previous_level
    ), earned AS (
      SELECT previous_xp, previous_level, previous_xp + ?6 AS new_xp FROM current_stats
    ), leveled AS (
      SELECT *, CASE ${levelSql} END AS new_level FROM earned
    )
    INSERT INTO product_game_reward_results (
      settlement_id, user_id, game_type, reward_kind, reward_date,
      previous_xp, xp_earned, new_xp, previous_level, new_level,
      normal_draws_earned, golden_draws_earned, stats_applied
    )
    SELECT ?1, ?2, ?3, ?4, date(?5 / 1000, 'unixepoch', '+8 hours'),
      previous_xp, ?6, new_xp, previous_level, new_level, ?7,
      ?8 + CASE WHEN new_level > previous_level THEN ?9 ELSE 0 END
      + CASE WHEN ?4 = 'completion' AND (
        SELECT COUNT(*) FROM product_game_reward_results
        WHERE user_id = ?2 AND game_type = ?3 AND reward_kind = 'completion'
          AND reward_date = date(?5 / 1000, 'unixepoch', '+8 hours')
      ) = ?10 - 1 THEN ?11 ELSE 0 END, 0
    FROM leveled WHERE EXISTS (SELECT 1 FROM users WHERE id = ?2 AND is_anonymous = 0)
      AND EXISTS (SELECT 1 FROM product_game_reward_claims WHERE id = ?1 AND is_settled = 0)
      AND NOT EXISTS (SELECT 1 FROM product_game_reward_results WHERE settlement_id = ?1 AND user_id = ?2)
  `,
    )
    .bind(
      input.settlementId,
      userId,
      input.gameType,
      input.kind,
      input.completedAt,
      policy === null ? 0 : policy.xpEarned,
      policy === null ? 0 : policy.normalDrawsEarned,
      mvpDraws,
      goldenCandidate,
      policy === null ? 0 : policy.dailyCompletionTarget,
      DAILY_COMPLETION_GOLDEN_DRAWS,
    );
}

function applyStats(db: D1Database, settlementId: string, userId: string): D1PreparedStatement {
  return db
    .prepare(
      `
    INSERT INTO user_stats (user_id, xp, level, games_played, normal_draws, golden_draws, updated_at)
    SELECT user_id, new_xp, new_level, CASE WHEN reward_kind = 'completion' THEN 1 ELSE 0 END,
      normal_draws_earned, golden_draws_earned, datetime('now')
    FROM product_game_reward_results WHERE settlement_id = ?1 AND user_id = ?2 AND stats_applied = 0
    ON CONFLICT (user_id) DO UPDATE SET
      xp = excluded.xp, level = excluded.level,
      games_played = user_stats.games_played + excluded.games_played,
      normal_draws = user_stats.normal_draws + excluded.normal_draws,
      golden_draws = user_stats.golden_draws + excluded.golden_draws,
      version = user_stats.version + 1, updated_at = excluded.updated_at
  `,
    )
    .bind(settlementId, userId);
}

/** Settle a server-authored round once; retries return its original committed rewards. */
export async function settleGameRewards(db: D1Database, input: GameRewardInput) {
  if (!input.settlementId || !Number.isSafeInteger(input.completedAt) || input.completedAt < 0) {
    throw new Error('[FAIL-FAST] Invalid game reward identity');
  }
  const participantUserIds = [...input.participantUserIds].sort();
  if (
    new Set(participantUserIds).size !== participantUserIds.length ||
    participantUserIds.some((userId) => !userId)
  ) {
    throw new Error('[FAIL-FAST] Invalid game reward roster');
  }
  if (input.kind === 'mvp' && participantUserIds.length !== 1) {
    throw new Error('[FAIL-FAST] MVP requires exactly one recipient');
  }
  const inputJson = canonicalJson({ ...input, participantUserIds });
  const statements = [
    db
      .prepare(
        `
    INSERT INTO product_game_reward_claims (id, input_json) VALUES (?1, ?2)
    ON CONFLICT (id) DO UPDATE SET input_json =
      CASE WHEN input_json = excluded.input_json THEN input_json ELSE NULL END
  `,
      )
      .bind(input.settlementId, inputJson),
  ];
  for (const userId of participantUserIds) {
    statements.push(
      insertResult(db, input, userId),
      applyStats(db, input.settlementId, userId),
      db
        .prepare(
          'UPDATE product_game_reward_results SET stats_applied = 1 WHERE settlement_id = ?1 AND user_id = ?2',
        )
        .bind(input.settlementId, userId),
    );
  }
  const read = db
    .prepare(
      `SELECT user_id AS userId, xp_earned AS xpEarned, new_xp AS newXp,
    previous_level AS previousLevel, new_level AS newLevel, normal_draws_earned AS normalDrawsEarned,
    golden_draws_earned AS goldenDrawsEarned, stats_applied AS statsApplied
    FROM product_game_reward_results WHERE settlement_id = ?1 ORDER BY user_id`,
    )
    .bind(input.settlementId);
  statements.push(
    db
      .prepare('UPDATE product_game_reward_claims SET is_settled = 1 WHERE id = ?1')
      .bind(input.settlementId),
    read,
  );
  const batches = await db.batch(statements);
  const results = z.array(rewardResultSchema).parse(batches[batches.length - 1].results);
  for (const result of results) {
    if (getLevel(result.newXp) !== result.newLevel)
      throw new Error('[FAIL-FAST] Reward level mismatch');
  }
  return results.map(({ statsApplied: _statsApplied, ...result }) => result);
}

/** Deliver completion or MVP results through the existing durable account inbox. */
export async function publishGameRewards(
  reward: Omit<RewardIdentity, 'settlementId'> & GameRewardPolicy & { readonly roundId: string },
  context: {
    readonly bindings: Pick<Env, 'DB'>;
    readonly roomIdentity: WorkerEffectRoomIdentity;
    readonly createdRevision: number;
    publishUserEvent(userId: string, eventId: string, message: object): Promise<void>;
  },
): Promise<void> {
  const settlementId = canonicalJson([
    context.roomIdentity.roomId,
    context.roomIdentity.creationId,
    reward.gameType,
    reward.roundId,
    reward.kind,
  ]);
  const input: GameRewardInput = { ...reward, settlementId };
  const results = await settleGameRewards(context.bindings.DB, input);
  for (const { userId, ...result } of results) {
    const eventId = canonicalJson([settlementId, userId]);
    await context.publishUserEvent(userId, eventId, {
      type: 'SETTLE_RESULT',
      eventId,
      gameType: input.gameType,
      settlementId,
      endedRevision: context.createdRevision,
      ...result,
    });
  }
}
