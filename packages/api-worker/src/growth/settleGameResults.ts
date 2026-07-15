/**
 * Persist Werewolf growth settlement as an effect-idempotent D1 transaction.
 *
 * The settlement-result ledger is the recovery boundary: retries return the exact
 * committed rewards instead of generating rewards or updating user stats again.
 */

import type { WerewolfGameEndedEffect } from '@werewolf/game-engine/games/werewolf/public';
import { type CampBucket, getRoleCamp } from '@werewolf/game-engine/games/werewolf/public';
import {
  getLevel,
  LEVEL_THRESHOLDS,
  rollGoldenDraws,
  rollNormalDraws,
  rollXp,
  XP_BASE,
  XP_RANDOM_BASE,
} from '@werewolf/game-engine/growth/level';
import { createSeededRng } from '@werewolf/game-engine/utils/random';

const MIN_HUMAN_PLAYERS = 6;

interface SettlementEnv {
  DB: D1Database;
}

interface HumanParticipant {
  readonly userId: string;
  readonly camp: CampBucket;
}

interface StoredSettlementResultRow {
  effect_id: string;
  user_id: string;
  room_code: string;
  participant_fingerprint: string;
  camp: string;
  previous_xp: number;
  xp_earned: number;
  new_xp: number;
  previous_level: number;
  new_level: number;
  normal_draws_earned: number;
  golden_draws_earned: number;
  stats_applied: number;
  settled_at: string;
}

function compareUserIds(left: { readonly userId: string }, right: { readonly userId: string }) {
  if (left.userId < right.userId) return -1;
  if (left.userId > right.userId) return 1;
  return 0;
}

/** Settlement result for one registered player. */
export interface PlayerSettleResult {
  userId: string;
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  normalDrawsEarned: number;
  goldenDrawsEarned: number;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[FAIL-FAST] ${field} must be a non-empty string`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`[FAIL-FAST] ${field} must be a non-negative integer`);
  }
  return value;
}

function requireCamp(value: unknown): CampBucket {
  if (value === 'wolf' || value === 'god' || value === 'villager' || value === 'third') {
    return value;
  }
  throw new Error('[FAIL-FAST] game_settlement_results.camp is invalid');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createRewardRng(effectId: string, userId: string, reward: string) {
  return createSeededRng(JSON.stringify([effectId, userId, reward]));
}

function collectHumanParticipants(effect: WerewolfGameEndedEffect): readonly HumanParticipant[] {
  const seenUserIds = new Set<string>();
  const humans: HumanParticipant[] = [];

  for (const participant of effect.payload.participants) {
    if (seenUserIds.has(participant.userId)) {
      throw new Error(
        `[FAIL-FAST] Werewolf settlement contains duplicate participant ${participant.userId}`,
      );
    }
    seenUserIds.add(participant.userId);
    if (participant.isBot) continue;
    humans.push({ userId: participant.userId, camp: getRoleCamp(participant.role) });
  }

  return humans.sort(compareUserIds);
}

async function createParticipantFingerprint(effect: WerewolfGameEndedEffect): Promise<string> {
  const participants = [...effect.payload.participants]
    .sort(compareUserIds)
    .map(({ userId, role, isBot }) => ({ userId, role, isBot }));
  return sha256Hex(JSON.stringify({ roomCode: effect.payload.roomCode, participants }));
}

const LEVEL_FROM_NEW_XP_SQL = [...LEVEL_THRESHOLDS]
  .map((threshold, level) => `WHEN new_xp >= ${threshold} THEN ${level}`)
  .reverse()
  .join(' ');

function createInsertResultStatement(
  db: D1Database,
  input: {
    readonly effectId: string;
    readonly roomCode: string;
    readonly participantFingerprint: string;
    readonly participant: HumanParticipant;
    readonly settledAt: string;
  },
): D1PreparedStatement {
  const xpRng = createRewardRng(input.effectId, input.participant.userId, 'xp');
  const normalDrawsEarned = rollNormalDraws(
    createRewardRng(input.effectId, input.participant.userId, 'normalDraws'),
  );
  const goldenDrawsCandidate = rollGoldenDraws(
    createRewardRng(input.effectId, input.participant.userId, 'goldenDraws'),
  );

  return db
    .prepare(
      `WITH current_stats AS (
        SELECT
          COALESCE((SELECT xp FROM user_stats WHERE user_id = ?2), 0) AS previous_xp,
          COALESCE((SELECT level FROM user_stats WHERE user_id = ?2), 0) AS previous_level
      ), reward AS (
        SELECT
          previous_xp,
          previous_level,
          ${XP_BASE} + CAST(?6 * (${XP_RANDOM_BASE + 1} + previous_level) AS INTEGER)
            AS xp_earned
        FROM current_stats
      ), leveled AS (
        SELECT
          previous_xp,
          previous_level,
          xp_earned,
          previous_xp + xp_earned AS new_xp
        FROM reward
      ), outcome AS (
        SELECT
          previous_xp,
          previous_level,
          xp_earned,
          new_xp,
          CASE ${LEVEL_FROM_NEW_XP_SQL} ELSE 0 END AS new_level
        FROM leveled
      )
      INSERT INTO game_settlement_results (
        effect_id,
        user_id,
        room_code,
        participant_fingerprint,
        camp,
        previous_xp,
        xp_earned,
        new_xp,
        previous_level,
        new_level,
        normal_draws_earned,
        golden_draws_earned,
        stats_applied,
        settled_at
      )
      SELECT
        ?1,
        ?2,
        ?3,
        ?4,
        ?5,
        previous_xp,
        xp_earned,
        new_xp,
        previous_level,
        new_level,
        ?7,
        CASE WHEN new_level > previous_level THEN ?8 ELSE 0 END,
        0,
        ?9
      FROM outcome
      WHERE EXISTS (
        SELECT 1 FROM users WHERE id = ?2 AND is_anonymous = 0
      )
      ON CONFLICT (effect_id, user_id) DO NOTHING`,
    )
    .bind(
      input.effectId,
      input.participant.userId,
      input.roomCode,
      input.participantFingerprint,
      input.participant.camp,
      xpRng(),
      normalDrawsEarned,
      goldenDrawsCandidate,
      input.settledAt,
    );
}

function createApplyStatsStatement(
  db: D1Database,
  effectId: string,
  userId: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO user_stats (
        user_id,
        xp,
        level,
        games_played,
        normal_draws,
        golden_draws,
        settled_at,
        updated_at
      )
      SELECT
        user_id,
        new_xp,
        new_level,
        1,
        normal_draws_earned,
        golden_draws_earned,
        settled_at,
        settled_at
      FROM game_settlement_results
      WHERE effect_id = ?1 AND user_id = ?2 AND stats_applied = 0
      ON CONFLICT (user_id) DO UPDATE SET
        xp = excluded.xp,
        level = excluded.level,
        games_played = user_stats.games_played + 1,
        normal_draws = user_stats.normal_draws + excluded.normal_draws,
        golden_draws = user_stats.golden_draws + excluded.golden_draws,
        version = user_stats.version + 1,
        settled_at = excluded.settled_at,
        updated_at = excluded.updated_at`,
    )
    .bind(effectId, userId);
}

function createMarkAppliedStatement(
  db: D1Database,
  effectId: string,
  userId: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE game_settlement_results
      SET stats_applied = 1
      WHERE effect_id = ?1 AND user_id = ?2 AND stats_applied = 0`,
    )
    .bind(effectId, userId);
}

function createCampSettlementStatement(
  db: D1Database,
  effectId: string,
  userId: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO camp_settlements (user_id, settle_key, camp, settled_at)
      SELECT user_id, effect_id, camp, settled_at
      FROM game_settlement_results
      WHERE effect_id = ?1 AND user_id = ?2
      ON CONFLICT (user_id, settle_key) DO NOTHING`,
    )
    .bind(effectId, userId);
}

async function readSettlementResults(
  db: D1Database,
  effectId: string,
  effect: WerewolfGameEndedEffect,
  participantFingerprint: string,
  participantsByUserId: ReadonlyMap<string, HumanParticipant>,
): Promise<PlayerSettleResult[]> {
  const response = await db
    .prepare(
      `SELECT
        effect_id,
        user_id,
        room_code,
        participant_fingerprint,
        camp,
        previous_xp,
        xp_earned,
        new_xp,
        previous_level,
        new_level,
        normal_draws_earned,
        golden_draws_earned,
        stats_applied,
        settled_at
      FROM game_settlement_results
      WHERE effect_id = ?1
      ORDER BY user_id`,
    )
    .bind(effectId)
    .all<StoredSettlementResultRow>();

  const results: PlayerSettleResult[] = [];
  for (const row of response.results) {
    const storedEffectId = requireNonEmptyString(
      row.effect_id,
      'game_settlement_results.effect_id',
    );
    const userId = requireNonEmptyString(row.user_id, 'game_settlement_results.user_id');
    const roomCode = requireNonEmptyString(row.room_code, 'game_settlement_results.room_code');
    const storedFingerprint = requireNonEmptyString(
      row.participant_fingerprint,
      'game_settlement_results.participant_fingerprint',
    );
    const participant = participantsByUserId.get(userId);
    if (participant === undefined) {
      throw new Error(`[FAIL-FAST] Settlement result ${effectId} contains unknown user ${userId}`);
    }
    if (
      storedEffectId !== effectId ||
      roomCode !== effect.payload.roomCode ||
      storedFingerprint !== participantFingerprint ||
      requireCamp(row.camp) !== participant.camp
    ) {
      throw new Error(`[FAIL-FAST] Settlement result ${effectId} does not match its game effect`);
    }
    if (
      requireNonNegativeInteger(row.stats_applied, 'game_settlement_results.stats_applied') !== 1
    ) {
      throw new Error(`[FAIL-FAST] Settlement result ${effectId}/${userId} was not applied`);
    }

    const previousXp = requireNonNegativeInteger(
      row.previous_xp,
      'game_settlement_results.previous_xp',
    );
    const xpEarned = requireNonNegativeInteger(row.xp_earned, 'game_settlement_results.xp_earned');
    const newXp = requireNonNegativeInteger(row.new_xp, 'game_settlement_results.new_xp');
    const previousLevel = requireNonNegativeInteger(
      row.previous_level,
      'game_settlement_results.previous_level',
    );
    const newLevel = requireNonNegativeInteger(row.new_level, 'game_settlement_results.new_level');
    const normalDrawsEarned = requireNonNegativeInteger(
      row.normal_draws_earned,
      'game_settlement_results.normal_draws_earned',
    );
    const goldenDrawsEarned = requireNonNegativeInteger(
      row.golden_draws_earned,
      'game_settlement_results.golden_draws_earned',
    );
    requireNonEmptyString(row.settled_at, 'game_settlement_results.settled_at');

    const expectedXp = rollXp(previousLevel, createRewardRng(effectId, userId, 'xp'));
    const expectedNormalDraws = rollNormalDraws(createRewardRng(effectId, userId, 'normalDraws'));
    const expectedGoldenDraws =
      newLevel > previousLevel
        ? rollGoldenDraws(createRewardRng(effectId, userId, 'goldenDraws'))
        : 0;
    if (
      previousXp + xpEarned !== newXp ||
      getLevel(newXp) !== newLevel ||
      xpEarned !== expectedXp ||
      normalDrawsEarned !== expectedNormalDraws ||
      goldenDrawsEarned !== expectedGoldenDraws
    ) {
      throw new Error(`[FAIL-FAST] Settlement result ${effectId}/${userId} is inconsistent`);
    }

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

/** Settle one ended-game effect and return the exact committed player results. */
export async function settleGameResults(
  effectId: string,
  effect: WerewolfGameEndedEffect,
  env: SettlementEnv,
): Promise<PlayerSettleResult[]> {
  requireNonEmptyString(effectId, 'effectId');
  requireNonEmptyString(effect.payload.roomCode, 'effect.payload.roomCode');

  const humanParticipants = collectHumanParticipants(effect);
  if (humanParticipants.length < MIN_HUMAN_PLAYERS) return [];

  const participantsByUserId = new Map(
    humanParticipants.map((participant) => [participant.userId, participant] as const),
  );
  const participantFingerprint = await createParticipantFingerprint(effect);
  const existingResults = await readSettlementResults(
    env.DB,
    effectId,
    effect,
    participantFingerprint,
    participantsByUserId,
  );
  if (existingResults.length > 0) return existingResults;

  const settledAt = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const participant of humanParticipants) {
    statements.push(
      createInsertResultStatement(env.DB, {
        effectId,
        roomCode: effect.payload.roomCode,
        participantFingerprint,
        participant,
        settledAt,
      }),
      createApplyStatsStatement(env.DB, effectId, participant.userId),
      createMarkAppliedStatement(env.DB, effectId, participant.userId),
      createCampSettlementStatement(env.DB, effectId, participant.userId),
    );
  }

  const batchResults = await env.DB.batch(statements);
  for (const result of batchResults) {
    if (!result.success) {
      throw new Error(`[FAIL-FAST] D1 settlement batch failed for effect ${effectId}`);
    }
  }

  return readSettlementResults(
    env.DB,
    effectId,
    effect,
    participantFingerprint,
    participantsByUserId,
  );
}
