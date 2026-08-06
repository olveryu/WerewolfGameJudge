/** Durable Object transactional outbox reader, delivery lease, and retry policy. */

import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import type { EffectScope, PendingOutboxEffect } from './types';

const OUTBOX_MAX_ATTEMPTS = 7;
const OUTBOX_DELIVERY_WATCHDOG_MS = 2 * 60_000;
const OUTBOX_RETRY_BASE_MS = 2_000;
const OUTBOX_RETRY_MAX_MS = 5 * 60_000;
const OUTBOX_ERROR_MAX_LENGTH = 2_000;

interface RawOutboxEffect extends Record<string, SqlStorageValue> {
  readonly id: SqlStorageValue;
  readonly scope: SqlStorageValue;
  readonly game_type: SqlStorageValue;
  readonly effect_type: SqlStorageValue;
  readonly payload_json: SqlStorageValue;
  readonly attempt_count: SqlStorageValue;
  readonly available_at: SqlStorageValue;
  readonly created_revision: SqlStorageValue;
  readonly created_at: SqlStorageValue;
}

interface AvailableAtRow extends Record<string, SqlStorageValue> {
  readonly available_at: SqlStorageValue;
}

interface EffectCountRow extends Record<string, SqlStorageValue> {
  readonly effect_count: SqlStorageValue;
}

export type ClaimOutboxResult =
  | { readonly kind: 'claimed'; readonly effect: PendingOutboxEffect }
  | { readonly kind: 'empty' }
  | { readonly kind: 'exhausted'; readonly effect: PendingOutboxEffect };

export type RetryOutboxResult = { readonly kind: 'scheduled' } | { readonly kind: 'exhausted' };

function parseNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function parseNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function parsePositiveInteger(value: unknown, label: string): number {
  const parsed = parseNonNegativeInteger(value, label);
  if (parsed === 0) throw new Error(`${label} must be positive`);
  return parsed;
}

function parseScope(value: unknown): EffectScope {
  if (value === 'platform' || value === 'game') return value;
  throw new Error(`effect_outbox.scope is invalid: ${String(value)}`);
}

function parseOutboxEffect(row: RawOutboxEffect): PendingOutboxEffect {
  const payloadJson = parseNonEmptyString(row.payload_json, 'effect_outbox.payload_json');
  return {
    id: parseNonEmptyString(row.id, 'effect_outbox.id'),
    scope: parseScope(row.scope),
    gameType: parseGameType(row.game_type),
    effectType: parseNonEmptyString(row.effect_type, 'effect_outbox.effect_type'),
    payload: JSON.parse(payloadJson),
    attemptCount: parseNonNegativeInteger(row.attempt_count, 'effect_outbox.attempt_count'),
    availableAt: parseNonNegativeInteger(row.available_at, 'effect_outbox.available_at'),
    createdRevision: parsePositiveInteger(row.created_revision, 'effect_outbox.created_revision'),
    createdAt: parseNonNegativeInteger(row.created_at, 'effect_outbox.created_at'),
  };
}

function retryDelayMs(attemptCount: number): number {
  return Math.min(OUTBOX_RETRY_BASE_MS * 2 ** (attemptCount - 1), OUTBOX_RETRY_MAX_MS);
}

export class EffectOutbox {
  readonly #storage: DurableObjectStorage;
  readonly #sql: SqlStorage;

  constructor(storage: DurableObjectStorage) {
    this.#storage = storage;
    this.#sql = storage.sql;
  }

  async claimNextDue(nowMs: number): Promise<ClaimOutboxResult> {
    return this.#storage.transaction(async () => {
      const rows = this.#sql
        .exec<RawOutboxEffect>(
          `SELECT
            id,
            scope,
            game_type,
            effect_type,
            payload_json,
            attempt_count,
            available_at,
            created_revision,
            created_at
          FROM effect_outbox
          WHERE status = 'pending' AND available_at <= ?
          ORDER BY available_at, created_at, id
          LIMIT 1`,
          nowMs,
        )
        .toArray();
      if (rows.length === 0) return { kind: 'empty' };
      if (rows.length !== 1) {
        throw new Error(`Expected one due outbox effect, received ${rows.length}`);
      }

      const effect = parseOutboxEffect(rows[0]);
      if (effect.attemptCount >= OUTBOX_MAX_ATTEMPTS) {
        return { kind: 'exhausted', effect };
      }

      const attemptCount = effect.attemptCount + 1;
      const watchdogAt = nowMs + OUTBOX_DELIVERY_WATCHDOG_MS;
      this.#sql
        .exec(
          `UPDATE effect_outbox
        SET attempt_count = ?, available_at = ?
        WHERE id = ? AND status = 'pending' AND attempt_count = ?
        RETURNING id`,
          attemptCount,
          watchdogAt,
          effect.id,
          effect.attemptCount,
        )
        .one();
      await this.#storage.setAlarm(watchdogAt);
      return {
        kind: 'claimed',
        effect: { ...effect, attemptCount, availableAt: watchdogAt },
      };
    });
  }

  readNextAvailableAt(): number | null {
    const row = this.#sql
      .exec<AvailableAtRow>(
        `SELECT MIN(available_at) AS available_at
        FROM effect_outbox
        WHERE status = 'pending'`,
      )
      .one();
    return row.available_at === null
      ? null
      : parseNonNegativeInteger(row.available_at, 'effect_outbox.available_at');
  }

  hasOutstandingEffects(): boolean {
    const row = this.#sql
      .exec<EffectCountRow>(
        "SELECT COUNT(*) AS effect_count FROM effect_outbox WHERE status = 'pending'",
      )
      .one();
    const effectCount = parseNonNegativeInteger(row.effect_count, 'effect_outbox count');
    return effectCount > 0;
  }

  markSucceeded(effectId: string): void {
    this.#sql.exec('DELETE FROM effect_outbox WHERE id = ? RETURNING id', effectId).one();
  }

  markRetryable(effect: PendingOutboxEffect, error: Error, nowMs: number): RetryOutboxResult {
    if (effect.attemptCount < 1) {
      throw new Error(`Outbox effect was not claimed before retry: ${effect.id}`);
    }
    const lastError = error.message.slice(0, OUTBOX_ERROR_MAX_LENGTH);
    if (effect.attemptCount >= OUTBOX_MAX_ATTEMPTS) {
      this.#sql
        .exec(
          `UPDATE effect_outbox
          SET last_error = ?
          WHERE id = ? AND status = 'pending' AND attempt_count = ?
          RETURNING id`,
          lastError,
          effect.id,
          effect.attemptCount,
        )
        .one();
      return { kind: 'exhausted' };
    }

    this.#sql
      .exec(
        `UPDATE effect_outbox
        SET available_at = ?, last_error = ?
        WHERE id = ? AND status = 'pending' AND attempt_count = ?
        RETURNING id`,
        nowMs + retryDelayMs(effect.attemptCount),
        lastError,
        effect.id,
        effect.attemptCount,
      )
      .one();
    return { kind: 'scheduled' };
  }

  markTerminalFailed(effect: PendingOutboxEffect, error: Error): void {
    const lastError = error.message.slice(0, OUTBOX_ERROR_MAX_LENGTH);
    this.#sql
      .exec(
        `UPDATE effect_outbox
        SET status = 'failed', last_error = ?
        WHERE id = ? AND status = 'pending' AND attempt_count = ?
        RETURNING id`,
        lastError,
        effect.id,
        effect.attemptCount,
      )
      .one();
  }
}
