/** Scheduled, leased Fibking word-pool replenishment through synchronous Gemini requests. */

import { z } from 'zod';

import type { Env } from '../../env';
import { sha256Hex } from '../../platform/crypto/sha256Hex';
import { createConfiguredFibWordProvider } from './wordProviders';
import { GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { FIB_WORD_PROMPT_VERSION } from './wordProviders/prompt';
import { FibWordProviderError } from './wordProviders/providerError';
import {
  FIB_GENERATED_WORD_CANDIDATE_COUNT,
  FIB_WORD_CATEGORIES,
  type FibWordCandidate,
  type FibWordCategory,
  type FibWordProvider,
  type FibWordReview,
} from './wordProviders/types';

const FIB_WORD_SUPPLY_MINIMUM_PER_CATEGORY = 80;
const FIB_WORD_SUPPLY_TARGET_PER_CATEGORY = 200;
export const FIB_WORD_SUPPLY_CADENCE_MS = 15 * 24 * 60 * 60 * 1_000;
const FIB_WORD_SUPPLY_MAX_REQUESTS_PER_CYCLE = 480;
export const FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION = 10;
const FIB_WORD_SUPPLY_REQUEST_INTERVAL_MS = 12_000;
const FIB_WORD_SUPPLY_REQUEST_TIMEOUT_MS = 30_000;

const FIB_WORD_SUPPLY_LEASE_MS = 20 * 60 * 1_000;
const MAX_SELECTION_KEY = 0x7fffffff;
const SELECTION_HASH_HEX_LENGTH = 8;

interface SupplyStateRow {
  readonly active_cycle_id: string | null;
  readonly lease_owner: string | null;
  readonly lease_expires_at: string | null;
  readonly last_completed_at: string | null;
}

interface InventoryRow {
  readonly category: FibWordCategory;
  readonly active_count: number;
}

interface SupplyCycle {
  readonly cycleId: string;
  readonly leaseOwner: string;
  readonly completedRequestCount: number;
}

interface SupplyCycleRow {
  readonly active_cycle_id: string;
  readonly request_count: number;
}

export interface FibWordSupplyOptions {
  readonly provider?: FibWordProvider;
  readonly requestIntervalMs?: number;
}

const supplyStateSchema: z.ZodType<SupplyStateRow> = z.strictObject({
  active_cycle_id: z.string().min(1).nullable(),
  lease_owner: z.string().min(1).nullable(),
  lease_expires_at: z.string().datetime({ offset: true }).nullable(),
  last_completed_at: z.string().datetime({ offset: true }).nullable(),
});

const inventoryRowsSchema: z.ZodType<InventoryRow[]> = z.array(
  z.strictObject({
    category: z.enum(FIB_WORD_CATEGORIES),
    active_count: z.number().int().nonnegative(),
  }),
);

const supplyCycleRowSchema: z.ZodType<SupplyCycleRow> = z.strictObject({
  active_cycle_id: z.string().min(1),
  request_count: z.number().int().nonnegative(),
});

function iso(nowMs: number): string {
  const date = new Date(nowMs);
  if (!Number.isFinite(date.getTime()))
    throw new Error(`Fib word supply time is invalid: ${nowMs}`);
  return date.toISOString();
}

async function readSupplyState(db: D1Database): Promise<SupplyStateRow> {
  const row = await db
    .prepare(
      `SELECT active_cycle_id, lease_owner, lease_expires_at, last_completed_at
       FROM fib_word_supply_state WHERE id = 1`,
    )
    .first();
  if (row === null) throw new Error('[FAIL-FAST] Fib word supply singleton is missing');
  return supplyStateSchema.parse(row);
}

async function readInventory(db: D1Database): Promise<Map<FibWordCategory, number>> {
  const result = await db
    .prepare(
      `SELECT category, COUNT(*) AS active_count
       FROM fib_words WHERE status = 'active' GROUP BY category`,
    )
    .all();
  const rows = inventoryRowsSchema.parse(result.results);
  return new Map(
    FIB_WORD_CATEGORIES.map((category) => [
      category,
      rows.find((row) => row.category === category)?.active_count ?? 0,
    ]),
  );
}

function requiresSupply(inventory: ReadonlyMap<FibWordCategory, number>): boolean {
  return FIB_WORD_CATEGORIES.some(
    (category) =>
      (inventory.get(category) ?? Number.POSITIVE_INFINITY) < FIB_WORD_SUPPLY_MINIMUM_PER_CATEGORY,
  );
}

function hasReachedSupplyTarget(inventory: ReadonlyMap<FibWordCategory, number>): boolean {
  return FIB_WORD_CATEGORIES.every(
    (category) => (inventory.get(category) ?? 0) >= FIB_WORD_SUPPLY_TARGET_PER_CATEGORY,
  );
}

function isCadenceBlocked(state: SupplyStateRow, nowMs: number): boolean {
  return (
    state.last_completed_at !== null &&
    nowMs - Date.parse(state.last_completed_at) < FIB_WORD_SUPPLY_CADENCE_MS
  );
}

async function claimSupplyCycle(db: D1Database, nowMs: number): Promise<SupplyCycle | null> {
  const proposedCycleId = crypto.randomUUID();
  const leaseOwner = crypto.randomUUID();
  const now = iso(nowMs);
  const leaseExpiresAt = iso(nowMs + FIB_WORD_SUPPLY_LEASE_MS);
  const cadenceBoundary = iso(nowMs - FIB_WORD_SUPPLY_CADENCE_MS);
  await db.batch([
    db
      .prepare(
        `UPDATE fib_word_supply_state
         SET lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
         WHERE id = 1 AND lease_expires_at <= ?`,
      )
      .bind(now, now),
    db
      .prepare(
        `UPDATE fib_word_supply_state
         SET active_cycle_id = COALESCE(active_cycle_id, ?),
             active_cycle_started_at = COALESCE(active_cycle_started_at, ?), lease_owner = ?,
             lease_expires_at = ?, updated_at = ?
         WHERE id = 1
           AND lease_owner IS NULL
           AND (last_completed_at IS NULL OR last_completed_at <= ?)`,
      )
      .bind(proposedCycleId, now, leaseOwner, leaseExpiresAt, now, cadenceBoundary),
    db
      .prepare(
        `INSERT INTO fib_word_generation_cycles (
           id, status, provider, model, prompt_version, request_count,
           accepted_count, duplicate_count, started_at
         )
         SELECT ?, 'running', 'gemini', ?, ?, 0, 0, 0, ?
         FROM fib_word_supply_state
         WHERE id = 1 AND active_cycle_id = ? AND lease_owner = ?`,
      )
      .bind(
        proposedCycleId,
        GEMINI_FIB_WORD_MODEL,
        FIB_WORD_PROMPT_VERSION,
        now,
        proposedCycleId,
        leaseOwner,
      ),
  ]);
  const claimed = supplyCycleRowSchema.nullable().parse(
    await db
      .prepare(
        `SELECT supply.active_cycle_id, cycle.request_count
       FROM fib_word_supply_state AS supply
       INNER JOIN fib_word_generation_cycles AS cycle ON cycle.id = supply.active_cycle_id
       WHERE supply.id = 1 AND supply.lease_owner = ? AND cycle.status = 'running'`,
      )
      .bind(leaseOwner)
      .first(),
  );
  return claimed === null
    ? null
    : {
        cycleId: claimed.active_cycle_id,
        leaseOwner,
        completedRequestCount: claimed.request_count,
      };
}

function selectionKeyFromHash(hash: string): number {
  return Number.parseInt(hash.slice(0, SELECTION_HASH_HEX_LENGTH), 16) & MAX_SELECTION_KEY;
}

async function persistCandidates(
  db: D1Database,
  cycle: SupplyCycle,
  category: FibWordCategory,
  candidates: readonly FibWordCandidate[],
  reviews: readonly FibWordReview[],
  nowMs: number,
): Promise<void> {
  if (candidates.length !== FIB_GENERATED_WORD_CANDIDATE_COUNT) {
    throw new Error(
      `[FAIL-FAST] Fib provider returned ${candidates.length} candidates instead of ${FIB_GENERATED_WORD_CANDIDATE_COUNT}`,
    );
  }
  if (reviews.length !== candidates.length) {
    throw new Error(
      `[FAIL-FAST] Fib provider reviewed ${reviews.length} candidates instead of ${candidates.length}`,
    );
  }
  const reviewedCandidates = candidates.map((candidate, index) => {
    const review = reviews[index];
    if (review === undefined || review.word !== candidate.word) {
      throw new Error(`[FAIL-FAST] Fib review did not match candidate at index ${index}`);
    }
    return { candidate, review };
  });
  const now = iso(nowMs);
  const reviewStatements = reviewedCandidates.map(({ candidate, review }) =>
    db
      .prepare(
        `INSERT INTO fib_word_candidate_reviews (
           word, core_meaning, usage_note, category, source, decision,
           reason, generation_cycle_id, reviewed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (word) DO NOTHING`,
      )
      .bind(
        candidate.word,
        candidate.definition.coreMeaning,
        candidate.definition.usageNote,
        category,
        candidate.source,
        review.decision,
        review.reason,
        cycle.cycleId,
        now,
      ),
  );
  const acceptedStatements = await Promise.all(
    reviewedCandidates
      .filter(({ review }) => review.decision === 'accepted')
      .map(async ({ candidate }) => {
        const wordHash = await sha256Hex(candidate.word);
        return db
          .prepare(
            `INSERT INTO fib_words (
             id, word, core_meaning, usage_note, category, source, status,
             selection_key, generation_cycle_id, created_at, activated_at
           )
           SELECT ?, ?, ?, ?, ?, 'gemini', 'active', ?, ?, ?, ?
           WHERE NOT EXISTS (
             SELECT 1 FROM fib_word_candidate_reviews
             WHERE word = ? AND decision = 'rejected'
           )
           ON CONFLICT (word) DO NOTHING`,
          )
          .bind(
            `fib-word:${wordHash}`,
            candidate.word,
            candidate.definition.coreMeaning,
            candidate.definition.usageNote,
            category,
            selectionKeyFromHash(wordHash),
            cycle.cycleId,
            now,
            now,
            candidate.word,
          );
      }),
  );
  const leaseExpiresAt = iso(nowMs + FIB_WORD_SUPPLY_LEASE_MS);
  await db.batch([
    ...reviewStatements,
    ...acceptedStatements,
    db
      .prepare(
        `UPDATE fib_word_generation_cycles
         SET request_count = request_count + 1,
             accepted_count = (
               SELECT COUNT(*) FROM fib_words WHERE generation_cycle_id = ?
             ),
             rejected_count = (
               SELECT COUNT(*) FROM fib_word_candidate_reviews
               WHERE generation_cycle_id = ? AND decision = 'rejected'
             ),
             duplicate_count = (request_count + 1) * ? - (
               SELECT COUNT(*) FROM fib_words WHERE generation_cycle_id = ?
             ) - (
               SELECT COUNT(*) FROM fib_word_candidate_reviews
               WHERE generation_cycle_id = ? AND decision = 'rejected'
             )
         WHERE id = ? AND status = 'running'`,
      )
      .bind(
        cycle.cycleId,
        cycle.cycleId,
        FIB_GENERATED_WORD_CANDIDATE_COUNT,
        cycle.cycleId,
        cycle.cycleId,
        cycle.cycleId,
      ),
    db
      .prepare(
        `UPDATE fib_word_supply_state
         SET lease_expires_at = ?, updated_at = ?
         WHERE id = 1 AND active_cycle_id = ? AND lease_owner = ?`,
      )
      .bind(leaseExpiresAt, now, cycle.cycleId, cycle.leaseOwner),
  ]);
}

function nextCategory(inventory: ReadonlyMap<FibWordCategory, number>): FibWordCategory | null {
  const eligible = FIB_WORD_CATEGORIES.filter(
    (category) => (inventory.get(category) ?? 0) < FIB_WORD_SUPPLY_TARGET_PER_CATEGORY,
  );
  return (
    eligible.sort((left, right) => (inventory.get(left) ?? 0) - (inventory.get(right) ?? 0))[0] ??
    null
  );
}

async function waitForRequestSlot(
  previousRequestStartedAt: number | null,
  requestIntervalMs: number,
): Promise<void> {
  if (previousRequestStartedAt === null) return;
  const remainingDelay = previousRequestStartedAt + requestIntervalMs - Date.now();
  if (remainingDelay <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, remainingDelay));
}

async function runSupplyRequests(
  db: D1Database,
  provider: FibWordProvider,
  cycle: SupplyCycle,
  startedAtMs: number,
  requestIntervalMs: number,
): Promise<void> {
  let inventory = await readInventory(db);
  let invocationRequestCount = 0;
  let totalRequestCount = cycle.completedRequestCount;
  let previousProviderRequestStartedAt: number | null = null;
  let category = nextCategory(inventory);
  while (
    category !== null &&
    invocationRequestCount < FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION &&
    totalRequestCount < FIB_WORD_SUPPLY_MAX_REQUESTS_PER_CYCLE
  ) {
    await waitForRequestSlot(previousProviderRequestStartedAt, requestIntervalMs);
    const generationRequestStartedAt = Date.now();
    previousProviderRequestStartedAt = generationRequestStartedAt;
    const candidates = await provider.generateBatch({
      category,
      deadlineAt: generationRequestStartedAt + FIB_WORD_SUPPLY_REQUEST_TIMEOUT_MS,
      signal: AbortSignal.timeout(FIB_WORD_SUPPLY_REQUEST_TIMEOUT_MS),
    });
    await waitForRequestSlot(previousProviderRequestStartedAt, requestIntervalMs);
    const reviewRequestStartedAt = Date.now();
    previousProviderRequestStartedAt = reviewRequestStartedAt;
    const reviews = await provider.reviewBatch(
      {
        category,
        deadlineAt: reviewRequestStartedAt + FIB_WORD_SUPPLY_REQUEST_TIMEOUT_MS,
        signal: AbortSignal.timeout(FIB_WORD_SUPPLY_REQUEST_TIMEOUT_MS),
      },
      candidates,
    );
    await persistCandidates(db, cycle, category, candidates, reviews, Date.now());
    invocationRequestCount += 1;
    totalRequestCount += 1;
    inventory = await readInventory(db);
    category = nextCategory(inventory);
  }
  if (category !== null && totalRequestCount >= FIB_WORD_SUPPLY_MAX_REQUESTS_PER_CYCLE) {
    throw new Error('[FAIL-FAST] Fib word supply exhausted its generation request budget');
  }
  if (Date.now() < startedAtMs) throw new Error('[FAIL-FAST] Fib supply clock moved backwards');
}

async function releaseCycleLease(db: D1Database, cycle: SupplyCycle, nowMs: number): Promise<void> {
  const now = iso(nowMs);
  await db
    .prepare(
      `UPDATE fib_word_supply_state
       SET lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
       WHERE id = 1 AND active_cycle_id = ? AND lease_owner = ?`,
    )
    .bind(now, cycle.cycleId, cycle.leaseOwner)
    .run();
}

async function completeCycle(db: D1Database, cycle: SupplyCycle, nowMs: number): Promise<void> {
  const now = iso(nowMs);
  await db.batch([
    db
      .prepare(
        `UPDATE fib_word_generation_cycles
         SET status = 'completed', completed_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .bind(now, cycle.cycleId),
    db
      .prepare(
        `UPDATE fib_word_supply_state
         SET active_cycle_id = NULL, active_cycle_started_at = NULL,
             lease_owner = NULL, lease_expires_at = NULL,
             last_completed_at = ?, updated_at = ?
         WHERE id = 1 AND active_cycle_id = ? AND lease_owner = ?`,
      )
      .bind(now, now, cycle.cycleId, cycle.leaseOwner),
  ]);
}

async function failCycle(
  db: D1Database,
  cycle: SupplyCycle,
  errorCode: string,
  nowMs: number,
): Promise<void> {
  const now = iso(nowMs);
  await db.batch([
    db
      .prepare(
        `UPDATE fib_word_generation_cycles
         SET status = 'failed', completed_at = ?, error_code = ?
         WHERE id = ? AND status = 'running'`,
      )
      .bind(now, errorCode, cycle.cycleId),
    db
      .prepare(
        `UPDATE fib_word_supply_state
         SET active_cycle_id = NULL, active_cycle_started_at = NULL,
             lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
         WHERE id = 1 AND active_cycle_id = ? AND lease_owner = ?`,
      )
      .bind(now, cycle.cycleId, cycle.leaseOwner),
  ]);
}

/** Check pool levels and run at most one cadence-gated replenishment cycle. */
export async function replenishFibWordPool(
  env: Env,
  nowMs: number,
  options: FibWordSupplyOptions = {},
): Promise<void> {
  const [state, inventory] = await Promise.all([readSupplyState(env.DB), readInventory(env.DB)]);
  if (
    state.active_cycle_id === null &&
    (!requiresSupply(inventory) || isCadenceBlocked(state, nowMs))
  ) {
    return;
  }
  const cycle = await claimSupplyCycle(env.DB, nowMs);
  if (cycle === null) return;
  try {
    await runSupplyRequests(
      env.DB,
      options.provider ?? createConfiguredFibWordProvider(env),
      cycle,
      nowMs,
      options.requestIntervalMs ?? FIB_WORD_SUPPLY_REQUEST_INTERVAL_MS,
    );
    const updatedInventory = await readInventory(env.DB);
    if (hasReachedSupplyTarget(updatedInventory)) {
      await completeCycle(env.DB, cycle, Date.now());
    } else {
      await releaseCycleLease(env.DB, cycle, Date.now());
    }
  } catch (error) {
    const errorCode = error instanceof FibWordProviderError ? error.failureKind : 'internalError';
    await failCycle(env.DB, cycle, errorCode, Date.now());
    throw error;
  }
}
