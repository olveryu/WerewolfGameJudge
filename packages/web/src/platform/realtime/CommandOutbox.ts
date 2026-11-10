/**
 * CommandOutbox — the single retry pipeline for room commands in one link epoch.
 *
 * Same intent (controlledSeat + canonical command) shares one commandId and one in-flight
 * promise. Durable intents are persisted before the first send and removed on a server decision.
 * Replays run only while the link is live, once per socket generation, then on a fixed ladder.
 * A durable dispatch() promise stays pending across replays and settles with the final decision
 * (or `cancelled` when the epoch ends).
 */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { CommandTransport } from './commandTransport';
import type { DurableCommandRecord, OutboxStorage } from './outboxStorage';
import type {
  DispatchOptions,
  DispatchOutcome,
  PreparedCommand,
  RoomIdentity,
  TimerHandle,
} from './types';

const REPLAY_LADDER_MS = [1_000, 3_000, 10_000, 30_000] as const;

interface PendingIntent<TState extends BaseGameState<string>> {
  readonly prepared: PreparedCommand<object>;
  readonly label: string;
  readonly durable: boolean;
  /** Socket generation during which the last attempt was made; -1 before the first. */
  attemptedGeneration: number;
  replayCount: number;
  nextReplayAtMs: number | null;
  inFlight: Promise<DispatchOutcome<TState>> | null;
  /** Durable callers waiting for the final decision. */
  readonly waiters: Array<{
    readonly resolve: (outcome: DispatchOutcome<TState>) => void;
    readonly reject: (error: unknown) => void;
  }>;
}

export interface CommandOutboxOptions<TState extends BaseGameState<string>> {
  readonly identity: RoomIdentity<string>;
  readonly epoch: number;
  readonly transport: CommandTransport<TState>;
  readonly storage: OutboxStorage;
  readonly newCommandId: () => string;
  readonly now: () => number;
  readonly setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  readonly clearTimeout: (handle: TimerHandle) => void;
  /** Called with every committed snapshot so the link can converge before the caller sees it. */
  readonly onCommitted: (outcome: Extract<DispatchOutcome<TState>, { kind: 'committed' }>) => void;
  readonly onPendingDurableCount: (count: number) => void;
}

export class CommandOutbox<TState extends BaseGameState<string>> {
  readonly #options: CommandOutboxOptions<TState>;
  readonly #intents = new Map<string, PendingIntent<TState>>();
  readonly #abort = new AbortController();
  #liveGeneration: number | null = null;
  #replayTimer: TimerHandle | null = null;
  #disposed = false;

  constructor(options: CommandOutboxOptions<TState>) {
    this.#options = options;
  }

  /** Load persisted durable intents for this room/user; they replay once the link is live. */
  restore(): void {
    this.#assertActive();
    const { identity, storage } = this.#options;
    for (const record of storage.load(identity.room.roomId, identity.userId)) {
      if (record.roomCode !== identity.room.roomCode) {
        throw new Error('[FAIL-FAST] Durable command roomCode changed for one room instance');
      }
      const prepared = this.#prepare(record.command, record.controlledSeat, record.commandId);
      const key = intentKey(prepared);
      if (this.#intents.has(key)) {
        throw new Error('[FAIL-FAST] Durable commands contain duplicate intents');
      }
      this.#intents.set(key, {
        prepared,
        label: record.label,
        durable: true,
        attemptedGeneration: -1,
        replayCount: 0,
        nextReplayAtMs: null,
        inFlight: null,
        waiters: [],
      });
    }
    this.#publishCount();
  }

  dispatch(command: object, options: DispatchOptions): Promise<DispatchOutcome<TState>> {
    this.#assertActive();
    const probe = this.#prepare(command, options.controlledSeat, 'probe');
    const key = intentKey(probe);
    let intent = this.#intents.get(key);
    if (intent === undefined) {
      const prepared = this.#prepare(command, options.controlledSeat, this.#options.newCommandId());
      intent = this.#register(key, prepared, options.label, options.durable);
    } else if (intent.durable !== options.durable) {
      throw new Error('[FAIL-FAST] Durability changed for one pending intent');
    }
    return this.#await(key, intent);
  }

  /** The link became live on `generation`; replay every durable intent not yet tried on it. */
  setLiveGeneration(generation: number | null): void {
    this.#assertActive();
    this.#liveGeneration = generation;
    this.#clearReplayTimer();
    if (generation !== null) this.#replayDue();
  }

  countDurable(): number {
    let count = 0;
    for (const intent of this.#intents.values()) if (intent.durable) count += 1;
    return count;
  }

  /** End the epoch: in-flight requests abort, durable waiters settle as cancelled, storage is kept. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#clearReplayTimer();
    this.#abort.abort(new DOMException('Room link epoch ended', 'AbortError'));
    for (const intent of this.#intents.values()) {
      const cancelled: DispatchOutcome<TState> = {
        kind: 'cancelled',
        commandId: intent.prepared.commandId,
      };
      for (const waiter of intent.waiters) waiter.resolve(cancelled);
      intent.waiters.length = 0;
    }
    this.#intents.clear();
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  #prepare<TCommand extends object>(
    command: TCommand,
    controlledSeat: number | null,
    commandId: string,
  ): PreparedCommand<TCommand> {
    const { identity, epoch } = this.#options;
    deepFreeze(command, new Set());
    return Object.freeze({
      epoch,
      roomCode: identity.room.roomCode,
      roomId: identity.room.roomId,
      commandId,
      command,
      controlledSeat,
    });
  }

  #register(
    key: string,
    prepared: PreparedCommand<object>,
    label: string,
    durable: boolean,
  ): PendingIntent<TState> {
    if (durable) {
      const { identity, storage, now } = this.#options;
      const record: DurableCommandRecord = {
        roomCode: prepared.roomCode,
        roomId: prepared.roomId,
        userId: identity.userId,
        commandId: prepared.commandId,
        command: prepared.command,
        controlledSeat: prepared.controlledSeat,
        label,
        createdAtMs: now(),
      };
      storage.save(record);
    }
    const intent: PendingIntent<TState> = {
      prepared,
      label,
      durable,
      attemptedGeneration: -1,
      replayCount: 0,
      nextReplayAtMs: null,
      inFlight: null,
      waiters: [],
    };
    this.#intents.set(key, intent);
    this.#publishCount();
    return intent;
  }

  /** Non-durable: the current attempt's outcome. Durable: the final decision, however long it takes. */
  #await(key: string, intent: PendingIntent<TState>): Promise<DispatchOutcome<TState>> {
    if (!intent.durable) return intent.inFlight ?? this.#attempt(key, intent);
    const decision = new Promise<DispatchOutcome<TState>>((resolve, reject) => {
      intent.waiters.push({ resolve, reject });
    });
    // HTTP does not need the socket: the first send goes out now; replays wait for a live link.
    if (intent.inFlight === null && intent.attemptedGeneration === -1) {
      void this.#attempt(key, intent);
    }
    return decision;
  }

  #attempt(key: string, intent: PendingIntent<TState>): Promise<DispatchOutcome<TState>> {
    intent.attemptedGeneration = this.#liveGeneration ?? 0;
    intent.nextReplayAtMs = null;
    const inFlight = this.#options.transport.send(intent.prepared, this.#abort.signal).then(
      (outcome) => {
        if (this.#disposed || this.#intents.get(key) !== intent) return outcome;
        intent.inFlight = null;
        if (outcome.kind === 'committed') this.#options.onCommitted(outcome);
        if (outcome.kind === 'committed' || outcome.kind === 'rejected') {
          this.#settle(key, intent, outcome);
        } else if (intent.durable) {
          this.#scheduleReplay(intent);
        } else {
          this.#intents.delete(key);
        }
        return outcome;
      },
      (error: unknown) => {
        // The server answered with a non-decision (4xx) or broke the contract: not retryable.
        if (!this.#disposed && this.#intents.get(key) === intent) {
          intent.inFlight = null;
          if (intent.durable) {
            const { identity, storage } = this.#options;
            storage.remove(identity.room.roomId, identity.userId, intent.prepared.commandId);
          }
          this.#intents.delete(key);
          for (const waiter of intent.waiters) waiter.reject(error);
          intent.waiters.length = 0;
          this.#publishCount();
        }
        throw error;
      },
    );
    intent.inFlight = inFlight;
    // Durable callers observe the decision through their waiters; this promise is internal.
    if (intent.durable) inFlight.catch(() => undefined);
    return inFlight;
  }

  #settle(key: string, intent: PendingIntent<TState>, outcome: DispatchOutcome<TState>): void {
    if (intent.durable) {
      const { identity, storage } = this.#options;
      storage.remove(identity.room.roomId, identity.userId, intent.prepared.commandId);
    }
    this.#intents.delete(key);
    for (const waiter of intent.waiters) waiter.resolve(outcome);
    intent.waiters.length = 0;
    this.#publishCount();
  }

  #scheduleReplay(intent: PendingIntent<TState>): void {
    const ladderIndex = Math.min(intent.replayCount, REPLAY_LADDER_MS.length - 1);
    intent.replayCount += 1;
    intent.nextReplayAtMs = this.#options.now() + REPLAY_LADDER_MS[ladderIndex]!;
    this.#armReplayTimer();
  }

  /** Replay durable intents that are due now or untried on the current live generation. */
  #replayDue(): void {
    const generation = this.#liveGeneration;
    if (generation === null) return;
    const now = this.#options.now();
    for (const [key, intent] of this.#intents) {
      if (!intent.durable || intent.inFlight !== null) continue;
      const untriedOnThisSocket = intent.attemptedGeneration !== generation;
      const due = intent.nextReplayAtMs !== null && intent.nextReplayAtMs <= now;
      if (untriedOnThisSocket || due) void this.#attempt(key, intent);
    }
    this.#armReplayTimer();
  }

  #armReplayTimer(): void {
    this.#clearReplayTimer();
    if (this.#liveGeneration === null) return;
    let earliest: number | null = null;
    for (const intent of this.#intents.values()) {
      if (!intent.durable || intent.inFlight !== null || intent.nextReplayAtMs === null) continue;
      earliest =
        earliest === null ? intent.nextReplayAtMs : Math.min(earliest, intent.nextReplayAtMs);
    }
    if (earliest === null) return;
    const delayMs = Math.max(0, earliest - this.#options.now());
    this.#replayTimer = this.#options.setTimeout(() => {
      this.#replayTimer = null;
      this.#replayDue();
    }, delayMs);
  }

  #clearReplayTimer(): void {
    if (this.#replayTimer === null) return;
    this.#options.clearTimeout(this.#replayTimer);
    this.#replayTimer = null;
  }

  #publishCount(): void {
    this.#options.onPendingDurableCount(this.countDurable());
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('[FAIL-FAST] CommandOutbox belongs to an ended epoch');
  }
}

function intentKey(prepared: PreparedCommand<object>): string {
  return canonicalJson({ controlledSeat: prepared.controlledSeat, command: prepared.command });
}

function deepFreeze(value: unknown, ancestors: Set<object>): void {
  if (value === null || typeof value !== 'object') return;
  if (ancestors.has(value)) throw new Error('Room command must not contain circular references');
  ancestors.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value))
    deepFreeze(item, ancestors);
  ancestors.delete(value);
  Object.freeze(value);
}
