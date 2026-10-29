/** `effect_outbox` + `effect_replays`: transactional outbox lease, retry policy and admin replay. */

import type { GameEffect } from '@game-judge/game-engine/platform/engine';
import { type GameType, parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import type { EffectScope, PendingOutboxEffect } from '../room/types';
import { requestWakeNoLaterThan } from './roomAlarm';
import { parseNonEmptyString, parseNonNegativeInteger, parsePositiveInteger } from './sqlValues';

export const OUTBOX_MAX_ATTEMPTS = 7;
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

export interface NewOutboxEffect {
  readonly id: string;
  readonly businessKey: string;
  readonly scope: EffectScope;
  readonly gameType: GameType;
  readonly effect: GameEffect;
  /** Delivery time (epoch ms); null delivers immediately. */
  readonly availableAt: number | null;
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

  /** Insert new effects for one committed command; the caller owns the surrounding transaction. */
  insertMany(
    originCommandId: string,
    effects: readonly NewOutboxEffect[],
    createdRevision: number,
    nowMs: number,
  ): void {
    for (const effect of effects) {
      this.#sql.exec(
        `INSERT INTO effect_outbox (
          id, origin_command_id, scope, game_type, effect_type, business_key, payload_json,
          status, attempt_count, available_at, created_revision, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
        effect.id,
        originCommandId,
        effect.scope,
        effect.gameType,
        effect.effect.type,
        effect.businessKey,
        JSON.stringify(effect.effect),
        effect.availableAt ?? nowMs,
        createdRevision,
        nowMs,
      );
    }
  }

  async claimNextDue(nowMs: number): Promise<ClaimOutboxResult> {
    return this.#storage.transaction(async () => {
      const rows = this.#sql
        .exec<RawOutboxEffect>(
          `SELECT id, scope, game_type, effect_type, payload_json, attempt_count, available_at,
            created_revision, created_at
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
      const watchdogAt = nowMs + OUTBOX_DELIVERY_WATCHDOG_MS;
      if (effect.attemptCount >= OUTBOX_MAX_ATTEMPTS) {
        this.#sql
          .exec(
            `UPDATE effect_outbox SET available_at = ?, last_error = ?
            WHERE id = ? AND status = 'pending' AND attempt_count = ? RETURNING id`,
            watchdogAt,
            'delivery interrupted at maximum attempt',
            effect.id,
            effect.attemptCount,
          )
          .one();
        await requestWakeNoLaterThan(this.#storage, watchdogAt);
        return { kind: 'exhausted', effect: { ...effect, availableAt: watchdogAt } };
      }

      const attemptCount = effect.attemptCount + 1;
      this.#sql
        .exec(
          `UPDATE effect_outbox SET attempt_count = ?, available_at = ?
          WHERE id = ? AND status = 'pending' AND attempt_count = ? RETURNING id`,
          attemptCount,
          watchdogAt,
          effect.id,
          effect.attemptCount,
        )
        .one();
      await requestWakeNoLaterThan(this.#storage, watchdogAt);
      return { kind: 'claimed', effect: { ...effect, attemptCount, availableAt: watchdogAt } };
    });
  }

  readNextAvailableAt(): number | null {
    const row = this.#sql
      .exec<AvailableAtRow>(
        "SELECT MIN(available_at) AS available_at FROM effect_outbox WHERE status = 'pending'",
      )
      .one();
    return row.available_at === null
      ? null
      : parseNonNegativeInteger(row.available_at, 'effect_outbox.available_at');
  }

  hasOutstandingEffects(): boolean {
    const row = this.#sql
      .exec<EffectCountRow>('SELECT COUNT(*) AS effect_count FROM effect_outbox')
      .one();
    return parseNonNegativeInteger(row.effect_count, 'effect_outbox count') > 0;
  }

  hasPendingEffects(): boolean {
    const row = this.#sql
      .exec<EffectCountRow>(
        "SELECT COUNT(*) AS effect_count FROM effect_outbox WHERE status = 'pending'",
      )
      .one();
    return parseNonNegativeInteger(row.effect_count, 'pending effect_outbox count') > 0;
  }

  discardFailedEffects(): number {
    return this.#sql
      .exec("DELETE FROM effect_outbox WHERE status = 'failed' RETURNING id")
      .toArray().length;
  }

  markSucceeded(effectId: string, nowMs: number): void {
    this.#storage.transactionSync(() => {
      this.#sql.exec(
        "UPDATE effect_replays SET status = 'succeeded', completed_at = ? WHERE effect_id = ? AND status = 'pending'",
        nowMs,
        effectId,
      );
      this.#sql.exec('DELETE FROM effect_outbox WHERE id = ? RETURNING id', effectId).one();
    });
  }

  /** Requeue the original failed effect, atomically recording the administrator's request. */
  async replayFailedEffect(
    id: string,
    effectId: string,
    reason: string,
    nowMs: number,
    canReplay: (effect: PendingOutboxEffect) => boolean,
  ): Promise<void> {
    await this.#storage.transaction(async () => {
      const previous = this.#sql
        .exec('SELECT effect_id, reason FROM effect_replays WHERE id = ?', id)
        .toArray()[0];
      if (previous !== undefined) {
        if (previous.effect_id !== effectId || previous.reason !== reason) {
          throw new Error('Replay request identity conflict');
        }
        return;
      }
      const row = this.#sql
        .exec<RawOutboxEffect>(
          "SELECT * FROM effect_outbox WHERE id = ? AND status = 'failed'",
          effectId,
        )
        .one();
      const effect = parseOutboxEffect(row);
      if (!canReplay(effect)) throw new Error('Game effect does not allow administrative replay');
      this.#sql.exec(
        "INSERT INTO effect_replays (id, effect_id, reason, requested_by, requested_at, original_effect_json, status) VALUES (?, ?, ?, 'admin-token', ?, ?, 'pending')",
        id,
        effectId,
        reason,
        nowMs,
        JSON.stringify(row),
      );
      this.#sql
        .exec(
          "UPDATE effect_outbox SET status = 'pending', attempt_count = 0, available_at = ?, last_error = NULL WHERE id = ? AND status = 'failed' RETURNING id",
          nowMs,
          effectId,
        )
        .one();
      await requestWakeNoLaterThan(this.#storage, nowMs);
    });
  }

  /** Read an audit entry without allowing callers to alter its original effect. */
  readReplay(id: string): Record<string, SqlStorageValue> | null {
    return this.#sql.exec('SELECT * FROM effect_replays WHERE id = ?', id).toArray()[0] ?? null;
  }

  markFailed(effect: PendingOutboxEffect, error: Error, nowMs: number): void {
    if (effect.attemptCount < 1) {
      throw new Error(`Outbox effect was not claimed before failure: ${effect.id}`);
    }
    const lastError = error.message.slice(0, OUTBOX_ERROR_MAX_LENGTH);
    const isTerminal = effect.attemptCount >= OUTBOX_MAX_ATTEMPTS;
    this.#storage.transactionSync(() => {
      const cursor = isTerminal
        ? this.#sql.exec(
            `UPDATE effect_outbox SET status = 'failed', last_error = ?
            WHERE id = ? AND status = 'pending' AND attempt_count = ? RETURNING id`,
            lastError,
            effect.id,
            effect.attemptCount,
          )
        : this.#sql.exec(
            `UPDATE effect_outbox SET available_at = ?, last_error = ?
            WHERE id = ? AND status = 'pending' AND attempt_count = ? RETURNING id`,
            nowMs + retryDelayMs(effect.attemptCount),
            lastError,
            effect.id,
            effect.attemptCount,
          );
      cursor.one();
      if (isTerminal) {
        this.#sql.exec(
          "UPDATE effect_replays SET status = 'failed', completed_at = ?, last_error = ? WHERE effect_id = ? AND status = 'pending'",
          nowMs,
          lastError,
          effect.id,
        );
      }
    });
  }
}
