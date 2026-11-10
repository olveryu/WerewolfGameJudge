/** Persists one unresolved asset operation per account; never replaces uncertain delivery. */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { z } from 'zod';

import { GACHA_OPERATION_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

const GACHA_REPLAY_RETENTION_MS = 24 * 60 * 60 * 1_000;
const requestSchema = z.discriminatedUnion('operation', [
  z.strictObject({
    operation: z.literal('draw'),
    drawType: z.enum(['normal', 'golden']),
    count: z.int().min(1).max(10),
  }),
  z.strictObject({ operation: z.literal('exchange'), rewardId: z.string().min(1) }),
]);
const operationSchema = z.strictObject({
  userId: z.string().min(1),
  idempotencyKey: z.uuid(),
  createdAtMs: z.int().nonnegative(),
  request: requestSchema,
});

export type GachaOperationRequest = z.output<typeof requestSchema>;
export type PendingGachaOperation = z.output<typeof operationSchema>;

interface GachaOperationStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class GachaOperationStore {
  readonly #listeners = new Set<() => void>();

  constructor(private readonly persistence: GachaOperationStorage = storage) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readSerialized(userId: string): string | null {
    return this.persistence.getString(`${GACHA_OPERATION_KEY}:${userId}`) ?? null;
  }

  load(userId: string): PendingGachaOperation | null {
    const serialized = this.readSerialized(userId);
    return this.parse(userId, serialized);
  }

  parse(userId: string, serialized: string | null): PendingGachaOperation | null {
    if (serialized === null) return null;
    const operation = operationSchema.parse(JSON.parse(serialized));
    if (operation.userId !== userId) throw new Error('抽奖操作账号不匹配');
    return operation;
  }

  begin(userId: string, request: GachaOperationRequest): PendingGachaOperation {
    const pending = this.load(userId);
    if (pending !== null) {
      if (canonicalJson(pending.request) !== canonicalJson(request)) {
        throw new Error('有待确认的抽奖或兑换，请先恢复原操作');
      }
      this.assertReplayable(pending);
      return pending;
    }
    const operation = operationSchema.parse({
      userId,
      request,
      idempotencyKey: crypto.randomUUID(),
      createdAtMs: Date.now(),
    });
    this.persistence.set(`${GACHA_OPERATION_KEY}:${userId}`, JSON.stringify(operation));
    this.#listeners.forEach((listener) => listener());
    return operation;
  }

  assertReplayable(operation: PendingGachaOperation): void {
    if (this.isExpired(operation)) {
      throw new Error(`操作已超过24小时，请联系反馈核对，操作号：${operation.idempotencyKey}`);
    }
  }

  isExpired(operation: PendingGachaOperation): boolean {
    return Date.now() - operation.createdAtMs >= GACHA_REPLAY_RETENTION_MS;
  }

  complete(operation: PendingGachaOperation): void {
    if (this.load(operation.userId)?.idempotencyKey !== operation.idempotencyKey) {
      throw new Error('待确认操作已改变');
    }
    this.persistence.remove(`${GACHA_OPERATION_KEY}:${operation.userId}`);
    this.#listeners.forEach((listener) => listener());
  }
}

export const gachaOperationStore = new GachaOperationStore();
