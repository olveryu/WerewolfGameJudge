/** Session-owned lifecycle for immutable room command envelopes. */

import type {
  BaseGameState,
  GameStateCodec,
  GameType,
  RoomCommandResult,
} from '@werewolf/game-engine';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';

import {
  type PreparedRoomCommand,
  prepareRoomCommand,
  sendPreparedRoomCommand,
} from './roomCommandTransport';

export interface RoomCommandSnapshotStore<TState> {
  applySnapshot(state: TState, revision: number): void;
}

interface RoomCommandSessionDeps<TState extends BaseGameState<GameType>> {
  readonly codec: GameStateCodec<TState>;
  readonly store: RoomCommandSnapshotStore<TState>;
}

interface RoomCommandOptions<TCommand extends object> {
  readonly roomCode: string;
  readonly command: TCommand;
  readonly controlledSeat: number | null;
}

interface DispatchRoomCommandOptions<TCommand extends object> extends RoomCommandOptions<TCommand> {
  readonly label: string;
}

interface ActiveRoomIdentity {
  readonly roomCode: string;
  readonly userId: string;
}

interface PendingRoomCommand {
  readonly prepared: PreparedRoomCommand<object>;
  readonly generation: number;
  inFlight: Promise<ActionResult> | null;
}

export type RoomCommandDispatchOutcome =
  | { readonly kind: 'decided'; readonly result: ActionResult }
  | {
      readonly kind: 'notDecided' | 'deliveryUnknown';
      readonly result: ActionResult;
    };

function encodeString(value: string): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Failed to encode room command string');
  return encoded;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown, path: string, ancestors: Set<object>): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return encodeString(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error(`Room command ${path} must contain a finite number`);
      }
      return JSON.stringify(value);
    case 'object': {
      if (ancestors.has(value)) {
        throw new Error(`Room command ${path} contains a circular reference`);
      }
      ancestors.add(value);

      let encoded: string;
      if (Array.isArray(value)) {
        encoded = `[${value
          .map((item, index) => {
            if (item === undefined) {
              throw new Error(`Room command ${path}[${index}] must not be undefined`);
            }
            return canonicalJson(item, `${path}[${index}]`, ancestors);
          })
          .join(',')}]`;
      } else {
        if (!isRecord(value)) {
          throw new Error(`Room command ${path} must contain a JSON object`);
        }
        const prototype = Reflect.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
          throw new Error(`Room command ${path} must contain only plain objects`);
        }
        const fields = Object.keys(value)
          .sort()
          .flatMap((key) => {
            const field = value[key];
            return field === undefined
              ? []
              : [`${encodeString(key)}:${canonicalJson(field, `${path}.${key}`, ancestors)}`];
          });
        encoded = `{${fields.join(',')}}`;
      }

      ancestors.delete(value);
      return encoded;
    }
    case 'undefined':
    case 'bigint':
    case 'function':
    case 'symbol':
      throw new Error(`Room command ${path} contains a non-JSON value`);
  }
  throw new Error(`Room command ${path} has an unsupported value`);
}

function createIntentKey<TCommand extends object>(options: RoomCommandOptions<TCommand>): string {
  return canonicalJson(
    {
      roomCode: options.roomCode,
      controlledSeat: options.controlledSeat,
      command: options.command,
    },
    '$',
    new Set(),
  );
}

function mapDecision<TState extends BaseGameState<GameType>>(
  decision: RoomCommandResult<TState>,
): ActionResult {
  if (decision.kind === 'rejected') {
    return { success: false, reason: decision.reason };
  }
  return decision.outcome.kind === 'domainRejected'
    ? { success: false, reason: decision.outcome.reason }
    : decision.outcome.reason === undefined
      ? { success: true }
      : { success: true, reason: decision.outcome.reason };
}

/** Owns command IDs for one authenticated room session. */
export class RoomCommandSession<TState extends BaseGameState<GameType>> {
  readonly #codec: GameStateCodec<TState>;
  readonly #store: RoomCommandSnapshotStore<TState>;
  readonly #pending = new Map<string, PendingRoomCommand>();
  #identity: ActiveRoomIdentity | null = null;
  #generation = 0;

  constructor(deps: RoomCommandSessionDeps<TState>) {
    this.#codec = deps.codec;
    this.#store = deps.store;
  }

  /** Start or resume one room/user identity; switching identity abandons prior envelopes. */
  enterRoom(roomCode: string, userId: string): void {
    if (roomCode.length === 0 || userId.length === 0) {
      throw new Error('Room command session identity must be non-empty');
    }
    if (this.#identity?.roomCode === roomCode && this.#identity.userId === userId) return;

    this.#generation += 1;
    this.#pending.clear();
    this.#identity = { roomCode, userId };
  }

  /** End the active identity and prevent late responses from applying snapshots. */
  leaveRoom(): void {
    this.#generation += 1;
    this.#pending.clear();
    this.#identity = null;
  }

  prepare<TCommand extends object>(
    options: RoomCommandOptions<TCommand>,
  ): PreparedRoomCommand<TCommand> {
    this.#assertActiveRoom(options.roomCode);
    createIntentKey(options);
    return prepareRoomCommand(options);
  }

  async dispatch<TCommand extends object>({
    label,
    ...options
  }: DispatchRoomCommandOptions<TCommand>): Promise<ActionResult> {
    this.#assertActiveRoom(options.roomCode);
    const intentKey = createIntentKey(options);
    let pending = this.#pending.get(intentKey);
    if (pending === undefined) {
      pending = {
        prepared: prepareRoomCommand(options),
        generation: this.#generation,
        inFlight: null,
      };
      this.#pending.set(intentKey, pending);
    }
    if (pending.inFlight !== null) return pending.inFlight;

    const entry = pending;
    const inFlight = this.dispatchPrepared(entry.prepared, label)
      .then((outcome) => {
        if (outcome.kind === 'decided' && this.#pending.get(intentKey) === entry) {
          this.#pending.delete(intentKey);
        }
        return outcome.result;
      })
      .finally(() => {
        if (this.#pending.get(intentKey) === entry) entry.inFlight = null;
      });
    entry.inFlight = inFlight;
    return inFlight;
  }

  async dispatchPrepared<TCommand extends object>(
    prepared: PreparedRoomCommand<TCommand>,
    label: string,
  ): Promise<RoomCommandDispatchOutcome> {
    this.#assertActiveRoom(prepared.roomCode);
    const generation = this.#generation;
    const attempt = await sendPreparedRoomCommand({
      prepared,
      codec: this.#codec,
      label,
    });
    if (attempt.kind !== 'decided') return attempt;

    const { decision } = attempt;
    if (decision.kind === 'committed' && generation === this.#generation) {
      this.#store.applySnapshot(decision.snapshot.state, decision.snapshot.revision);
    }
    return { kind: 'decided', result: mapDecision(decision) };
  }

  #assertActiveRoom(roomCode: string): void {
    if (this.#identity === null) {
      throw new Error('[FAIL-FAST] Room command session is not active');
    }
    if (this.#identity.roomCode !== roomCode) {
      throw new Error(
        `[FAIL-FAST] Room command belongs to ${roomCode}, not ${this.#identity.roomCode}`,
      );
    }
  }
}
