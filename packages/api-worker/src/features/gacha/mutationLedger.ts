/** Atomic D1 ledger for gacha mutations and their replay responses. */

import type { DrawType, Rarity, RewardType } from '@game-judge/game-engine/product/rewards';
import { z } from 'zod';

import { GACHA_MUTATION_OPERATIONS, type GachaMutationOperation } from './dbSchema';

const storedMutationSchema = z.strictObject({
  user_id: z.string().min(1),
  operation: z.enum(GACHA_MUTATION_OPERATIONS),
  is_applied: z.number().int(),
  response: z.string(),
});

export type GachaReplayResult<TResponse> =
  | { readonly kind: 'miss' }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'replay'; readonly response: TResponse };

interface ReplayIdentity<TResponse> {
  readonly userId: string;
  readonly key: string;
  readonly operation: GachaMutationOperation;
  readonly decodeResponse: (value: unknown) => TResponse;
}

type MutationIdentity<TResponse> = Omit<ReplayIdentity<TResponse>, 'operation'>;

export interface GachaDrawHistoryEntry {
  readonly id: string;
  readonly drawType: DrawType;
  readonly rarity: Rarity;
  readonly rewardType: RewardType;
  readonly rewardId: string;
  readonly pityCount: number;
  readonly isPityTriggered: number;
  readonly isDuplicate: number;
  readonly shardsAwarded: number;
  readonly createdAt: string;
}

interface DrawMutationInput<TResponse> extends MutationIdentity<TResponse> {
  readonly drawType: DrawType;
  readonly expectedVersion: number;
  readonly count: number;
  readonly nextPity: number;
  readonly unlockedItemsJson: string;
  readonly shardsAwarded: number;
  readonly historyEntries: readonly GachaDrawHistoryEntry[];
  readonly response: TResponse;
}

interface ExchangeMutationInput<TResponse> extends MutationIdentity<TResponse> {
  readonly expectedVersion: number;
  readonly cost: number;
  readonly unlockedItemsJson: string;
  readonly response: TResponse;
}

function parsePersistedJson(response: string, key: string): unknown {
  try {
    return JSON.parse(response);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error(`[FAIL-FAST] Gacha replay ${key} contains invalid JSON`, { cause: error });
  }
}

/** Read and validate one committed replay without exposing another owner's response. */
export async function readGachaReplay<TResponse>(
  db: D1Database,
  identity: ReplayIdentity<TResponse>,
): Promise<GachaReplayResult<TResponse>> {
  const row = await db
    .prepare(
      `SELECT user_id, operation, is_applied, response
       FROM idempotency_keys
       WHERE key = ?1`,
    )
    .bind(identity.key)
    .first();
  if (row === null) return { kind: 'miss' };

  const stored = storedMutationSchema.parse(row);
  if (stored.is_applied !== 1) {
    throw new Error(`[FAIL-FAST] Gacha replay ${identity.key} is not applied`);
  }
  if (stored.user_id !== identity.userId || stored.operation !== identity.operation) {
    return { kind: 'conflict' };
  }

  return {
    kind: 'replay',
    response: identity.decodeResponse(parsePersistedJson(stored.response, identity.key)),
  };
}

function createClaimStatement(
  db: D1Database,
  input: Pick<ReplayIdentity<unknown>, 'key' | 'operation' | 'userId'>,
  claimId: string,
  responseJson: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO idempotency_keys (
         key, user_id, claim_id, operation, is_applied, response, created_at
       ) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)
       ON CONFLICT (key) DO NOTHING`,
    )
    .bind(
      input.key,
      input.userId,
      claimId,
      input.operation,
      responseJson,
      new Date().toISOString(),
    );
}

function createMarkAppliedStatement(
  db: D1Database,
  input: Pick<ReplayIdentity<unknown>, 'key' | 'operation' | 'userId'> & {
    readonly expectedVersion: number;
  },
  claimId: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE idempotency_keys
       SET is_applied = 1
       WHERE key = ?1
         AND user_id = ?2
         AND claim_id = ?3
         AND operation = ?4
         AND is_applied = 0
         AND EXISTS (
           SELECT 1 FROM user_stats
           WHERE user_id = ?2 AND version = ?5
         )`,
    )
    .bind(input.key, input.userId, claimId, input.operation, input.expectedVersion);
}

function createCleanupStatement(db: D1Database, key: string, claimId: string): D1PreparedStatement {
  return db
    .prepare(
      `DELETE FROM idempotency_keys
       WHERE key = ?1 AND claim_id = ?2 AND is_applied = 0`,
    )
    .bind(key, claimId);
}

async function commitMutation<TResponse>(
  db: D1Database,
  input: ReplayIdentity<TResponse> & {
    readonly expectedVersion: number;
    readonly response: TResponse;
  },
  createBeforeApplyStatements: (claimId: string) => readonly D1PreparedStatement[],
  createStatsMutationStatement: (claimId: string) => D1PreparedStatement,
): Promise<GachaReplayResult<TResponse>> {
  const responseJson = JSON.stringify(input.response);
  if (responseJson === undefined) {
    throw new Error(`[FAIL-FAST] Gacha ${input.operation} response is not JSON serializable`);
  }

  const claimId = crypto.randomUUID();
  const statements = [
    createClaimStatement(db, input, claimId, responseJson),
    ...createBeforeApplyStatements(claimId),
    createMarkAppliedStatement(db, input, claimId),
    createStatsMutationStatement(claimId),
    createCleanupStatement(db, input.key, claimId),
  ];
  const results = await db.batch(statements);
  for (const result of results) {
    if (!result.success) {
      throw new Error(`[FAIL-FAST] Gacha ${input.operation} mutation batch failed`);
    }
  }

  return readGachaReplay(db, input);
}

/** Commit draw stats, immutable history, and replay in one D1 transaction. */
export function commitGachaDraw<TResponse>(
  db: D1Database,
  input: DrawMutationInput<TResponse>,
): Promise<GachaReplayResult<TResponse>> {
  if (input.historyEntries.length === 0) {
    throw new Error('[FAIL-FAST] A validated draw must produce history entries');
  }
  if (input.historyEntries.length !== input.count) {
    throw new Error('[FAIL-FAST] Draw count and history entry count differ');
  }
  if (input.historyEntries.some((entry) => entry.drawType !== input.drawType)) {
    throw new Error('[FAIL-FAST] Draw history contains a different draw type');
  }

  return commitMutation(
    db,
    { ...input, operation: 'draw' },
    (claimId) =>
      input.historyEntries.map((entry) =>
        db
          .prepare(
            `INSERT INTO draw_history (
               id, user_id, draw_type, rarity, reward_type, reward_id,
               pity_count, is_pity_triggered, is_duplicate, shards_awarded, created_at
             )
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
             WHERE EXISTS (
               SELECT 1
               FROM idempotency_keys AS mutation
               JOIN user_stats AS stats ON stats.user_id = mutation.user_id
               WHERE mutation.key = ?12
                 AND mutation.user_id = ?2
                 AND mutation.claim_id = ?13
                 AND mutation.operation = 'draw'
                 AND mutation.is_applied = 0
                 AND stats.version = ?14
             )`,
          )
          .bind(
            entry.id,
            input.userId,
            entry.drawType,
            entry.rarity,
            entry.rewardType,
            entry.rewardId,
            entry.pityCount,
            entry.isPityTriggered,
            entry.isDuplicate,
            entry.shardsAwarded,
            entry.createdAt,
            input.key,
            claimId,
            input.expectedVersion,
          ),
      ),
    (claimId) => {
      const isGolden = input.drawType === 'golden';
      return db
        .prepare(
          `UPDATE user_stats
           SET ${isGolden ? 'golden_draws' : 'normal_draws'} =
                 ${isGolden ? 'golden_draws' : 'normal_draws'} - ?1,
               ${isGolden ? 'golden_pity' : 'normal_pity'} = ?2,
               unlocked_items = ?3,
               shards = shards + ?4,
               version = version + 1,
               updated_at = datetime('now')
           WHERE user_id = ?5
             AND version = ?6
             AND EXISTS (
               SELECT 1 FROM idempotency_keys
               WHERE key = ?7
                 AND user_id = ?5
                 AND claim_id = ?8
                 AND operation = 'draw'
                 AND is_applied = 1
             )`,
        )
        .bind(
          input.count,
          input.nextPity,
          input.unlockedItemsJson,
          input.shardsAwarded,
          input.userId,
          input.expectedVersion,
          input.key,
          claimId,
        );
    },
  );
}

/** Commit shard exchange stats and replay in one D1 transaction. */
export function commitGachaExchange<TResponse>(
  db: D1Database,
  input: ExchangeMutationInput<TResponse>,
): Promise<GachaReplayResult<TResponse>> {
  return commitMutation(
    db,
    { ...input, operation: 'exchange' },
    () => [],
    (claimId) =>
      db
        .prepare(
          `UPDATE user_stats
           SET shards = shards - ?1,
               unlocked_items = ?2,
               version = version + 1,
               updated_at = datetime('now')
           WHERE user_id = ?3
             AND version = ?4
             AND EXISTS (
               SELECT 1 FROM idempotency_keys
               WHERE key = ?5
                 AND user_id = ?3
                 AND claim_id = ?6
                 AND operation = 'exchange'
                 AND is_applied = 1
             )`,
        )
        .bind(
          input.cost,
          input.unlockedItemsJson,
          input.userId,
          input.expectedVersion,
          input.key,
          claimId,
        ),
  );
}
