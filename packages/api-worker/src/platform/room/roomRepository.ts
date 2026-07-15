/** Strict persistence boundary for room state, receipts, and transactional outbox rows. */

import type {
  CommandActor,
  CreateGameContext,
  GameEffect,
} from '@game-judge/game-engine/platform/engine';
import type { RoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { type GameType, parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { REASON_ROOM_INITIALIZATION_CONFLICT } from '@game-judge/game-engine/platform/protocol/reasons';
import {
  type BaseGameState,
  createRoomSnapshot,
  type RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type {
  RuntimeWorkerGameModule,
  WorkerGameModuleResolver,
} from '../gameModules/runtimeGameModule';
import type {
  DispatchRoomCommand,
  EffectScope,
  InitializeRoomCommand,
  InitializeRoomResult,
  StoredRoomRow,
} from './types';

const COMMAND_RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

interface RawRoomRow extends Record<string, SqlStorageValue> {
  readonly creation_id: SqlStorageValue;
  readonly initialization_json: SqlStorageValue;
  readonly game_type: SqlStorageValue;
  readonly state_version: SqlStorageValue;
  readonly game_state: SqlStorageValue;
  readonly revision: SqlStorageValue;
  readonly created_at: SqlStorageValue;
  readonly updated_at: SqlStorageValue;
}

interface RawCommandReceipt extends Record<string, SqlStorageValue> {
  readonly game_type: SqlStorageValue;
  readonly state_version: SqlStorageValue;
  readonly actor_kind: SqlStorageValue;
  readonly actor_id: SqlStorageValue;
  readonly controlled_seat: SqlStorageValue;
  readonly command_type: SqlStorageValue;
  readonly request_json: SqlStorageValue;
  readonly random_seed: SqlStorageValue;
  readonly decision_kind: SqlStorageValue;
  readonly revision: SqlStorageValue;
  readonly result_json: SqlStorageValue;
}

export interface StoredCommandReceipt {
  readonly result: RoomCommandResult<BaseGameState<GameType>>;
  readonly randomSeed: string;
}

export interface NewOutboxEffect {
  readonly id: string;
  readonly businessKey: string;
  readonly scope: EffectScope;
  readonly gameType: GameType;
  readonly effect: GameEffect;
}

export interface PersistRoomCommand {
  readonly previous: StoredRoomRow;
  readonly state: BaseGameState<GameType>;
  readonly request: DispatchRoomCommand;
  readonly requestJson: string;
  readonly randomSeed: string;
  readonly result: RoomCommandResult<BaseGameState<GameType>>;
  readonly hasStateEvents: boolean;
  readonly effects: readonly NewOutboxEffect[];
  readonly decidedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function parsePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function parseNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function parseControlledSeat(value: unknown): number | null {
  return value === null ? null : parseNonNegativeInteger(value, 'command_receipts.controlled_seat');
}

function parseActorKind(value: unknown): 'user' | 'system' {
  if (value === 'user' || value === 'system') return value;
  throw new Error(`command_receipts.actor_kind is invalid: ${String(value)}`);
}

function parseDecisionKind(value: unknown): RoomCommandResult<BaseGameState<GameType>>['kind'] {
  if (value === 'committed' || value === 'rejected') return value;
  throw new Error(`command_receipts.decision_kind is invalid: ${String(value)}`);
}

function actorKind(actor: CommandActor): 'user' | 'system' {
  return actor.kind;
}

function actorId(actor: CommandActor): string {
  return actor.kind === 'user' ? actor.userId : actor.effectId;
}

function parseInitializationJson(
  value: unknown,
  expected: {
    readonly creationId: string;
    readonly gameType: GameType;
    readonly roomCode: string;
    readonly hostUserId: string;
  },
): string {
  const initializationJson = parseNonEmptyString(value, 'room_state.initialization_json');
  const parsed: unknown = JSON.parse(initializationJson);
  if (!isRecord(parsed)) {
    throw new Error('room_state.initialization_json must contain an object');
  }
  const expectedKeys = ['roomCode', 'gameType', 'hostUserId', 'config', 'creationId'];
  const actualKeys = Object.keys(parsed);
  if (
    actualKeys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => actualKeys.includes(key))
  ) {
    throw new Error('room_state.initialization_json has unsupported fields');
  }
  if (
    parsed.creationId !== expected.creationId ||
    parsed.gameType !== expected.gameType ||
    parsed.roomCode !== expected.roomCode ||
    parsed.hostUserId !== expected.hostUserId
  ) {
    throw new Error('room_state initialization does not match persisted state identity');
  }
  return initializationJson;
}

export function serializeCommandRequest(request: DispatchRoomCommand): string {
  return JSON.stringify({
    actor: request.actor,
    controlledSeat: request.controlledSeat,
    command: request.command,
  });
}

export function getCommittedRevision(previous: StoredRoomRow, hasStateEvents: boolean): number {
  return hasStateEvents ? previous.revision + 1 : previous.revision;
}

function parseRoomRow(raw: RawRoomRow, resolveGameModule: WorkerGameModuleResolver): StoredRoomRow {
  const gameType = parseGameType(raw.game_type);
  const module = resolveGameModule(gameType);
  const stateVersion = parsePositiveInteger(raw.state_version, 'room_state.state_version');
  if (stateVersion !== module.stateVersion) {
    throw new Error(`Unsupported ${gameType} state version: ${stateVersion}`);
  }

  const stateJson = parseNonEmptyString(raw.game_state, 'room_state.game_state');
  const state = module.parseState(JSON.parse(stateJson));
  const creationId = parseNonEmptyString(raw.creation_id, 'room_state.creation_id');
  const initializationJson = parseInitializationJson(raw.initialization_json, {
    creationId,
    gameType,
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
  });

  return {
    roomCode: state.roomCode,
    gameType,
    hostUserId: state.hostUserId,
    creationId,
    initializationJson,
    stateVersion,
    state,
    stateJson,
    revision: parsePositiveInteger(raw.revision, 'room_state.revision'),
    createdAt: parseNonNegativeInteger(raw.created_at, 'room_state.created_at'),
    updatedAt: parseNonNegativeInteger(raw.updated_at, 'room_state.updated_at'),
  };
}

function createInitializationJson(
  command: InitializeRoomCommand,
  gameType: GameType,
  configJson: string,
): string {
  const config: unknown = JSON.parse(configJson);
  return JSON.stringify({
    roomCode: command.roomCode,
    gameType,
    hostUserId: command.hostUserId,
    config,
    creationId: command.creationId,
  });
}

/** SQL operations remain synchronous except the transaction that also installs an alarm. */
export class RoomRepository {
  readonly #storage: DurableObjectStorage;
  readonly #sql: SqlStorage;
  readonly #resolveGameModule: WorkerGameModuleResolver;

  constructor(storage: DurableObjectStorage, resolveGameModule: WorkerGameModuleResolver) {
    this.#storage = storage;
    this.#sql = storage.sql;
    this.#resolveGameModule = resolveGameModule;
  }

  readRoom(): StoredRoomRow | null {
    const rows = this.#sql
      .exec<RawRoomRow>(
        `SELECT
          creation_id,
          initialization_json,
          game_type,
          state_version,
          game_state,
          revision,
          created_at,
          updated_at
        FROM room_state
        WHERE id = 1`,
      )
      .toArray();
    if (rows.length === 0) return null;
    if (rows.length !== 1) {
      throw new Error(`room_state must contain at most one row, received ${rows.length}`);
    }
    return parseRoomRow(rows[0], this.#resolveGameModule);
  }

  readSnapshot(): RoomSnapshot<BaseGameState<GameType>> | null {
    const room = this.readRoom();
    return room === null ? null : createRoomSnapshot(room.state, room.revision);
  }

  initialize(command: InitializeRoomCommand, nowMs: number): InitializeRoomResult {
    const gameType = parseGameType(command.gameType);
    const module = this.#resolveGameModule(gameType);
    const createContext: CreateGameContext = {
      roomCode: command.roomCode,
      hostUserId: command.hostUserId,
      nowMs,
      commandId: command.creationId,
    };
    const created = module.createInitialState(command.config, createContext);
    if (created.kind === 'invalidConfig') {
      return { success: false, reason: created.reason };
    }
    if (
      created.state.roomCode !== command.roomCode ||
      created.state.hostUserId !== command.hostUserId
    ) {
      throw new Error('Game engine created state with mismatched room metadata');
    }
    const initializationJson = createInitializationJson(command, gameType, created.configJson);

    const existing = this.readRoom();
    if (existing !== null) {
      const isExactReplay =
        existing.creationId === command.creationId &&
        existing.initializationJson === initializationJson;
      return isExactReplay
        ? {
            success: true,
            snapshot: createRoomSnapshot(existing.state, existing.revision),
            isReplay: true,
          }
        : { success: false, reason: REASON_ROOM_INITIALIZATION_CONFLICT };
    }

    this.#storage.transactionSync(() => {
      this.#sql.exec(
        `INSERT INTO room_state (
          id,
          creation_id,
          initialization_json,
          game_type,
          state_version,
          game_state,
          revision,
          created_at,
          updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, 1, ?, ?)`,
        command.creationId,
        initializationJson,
        gameType,
        created.state.stateVersion,
        JSON.stringify(created.state),
        nowMs,
        nowMs,
      );
    });

    return {
      success: true,
      snapshot: createRoomSnapshot(created.state, 1),
      isReplay: false,
    };
  }

  deleteExpiredReceipts(nowMs: number): void {
    this.#sql.exec(
      `DELETE FROM command_receipts
      WHERE expires_at <= ?
        AND NOT EXISTS (
          SELECT 1
          FROM effect_outbox
          WHERE effect_outbox.origin_command_id = command_receipts.command_id
        )`,
      nowMs,
    );
  }

  readReceipt(
    request: DispatchRoomCommand,
    requestJson: string,
    room: StoredRoomRow,
    module: RuntimeWorkerGameModule,
  ): StoredCommandReceipt | null | 'conflict' {
    const rows = this.#sql
      .exec<RawCommandReceipt>(
        `SELECT
          game_type,
          state_version,
          actor_kind,
          actor_id,
          controlled_seat,
          command_type,
          request_json,
          random_seed,
          decision_kind,
          revision,
          result_json
        FROM command_receipts
        WHERE command_id = ?`,
        request.commandId,
      )
      .toArray();
    if (rows.length === 0) return null;
    if (rows.length !== 1) {
      throw new Error(`command_receipts returned ${rows.length} rows for one command ID`);
    }

    const row = rows[0];
    const storedGameType = parseGameType(row.game_type);
    const storedStateVersion = parsePositiveInteger(
      row.state_version,
      'command_receipts.state_version',
    );
    const storedActorKind = parseActorKind(row.actor_kind);
    const storedActorId = parseNonEmptyString(row.actor_id, 'command_receipts.actor_id');
    const storedRequestJson = parseNonEmptyString(
      row.request_json,
      'command_receipts.request_json',
    );
    const storedControlledSeat = parseControlledSeat(row.controlled_seat);
    if (!isRecord(request.command)) {
      throw new Error('DispatchRoomCommand.command must be an object');
    }
    const requestedCommandType = parseNonEmptyString(request.command.type, 'command.type');
    const storedCommandType = parseNonEmptyString(
      row.command_type,
      'command_receipts.command_type',
    );
    if (
      storedGameType !== room.gameType ||
      storedStateVersion !== room.stateVersion ||
      storedActorKind !== actorKind(request.actor) ||
      storedActorId !== actorId(request.actor) ||
      storedControlledSeat !== request.controlledSeat ||
      storedCommandType !== requestedCommandType ||
      storedRequestJson !== requestJson
    ) {
      return 'conflict';
    }

    const revision = parsePositiveInteger(row.revision, 'command_receipts.revision');
    const resultJson = parseNonEmptyString(row.result_json, 'command_receipts.result_json');
    const result = module.parseCommandResult(JSON.parse(resultJson));
    const decisionKind = parseDecisionKind(row.decision_kind);
    if (result.commandId !== request.commandId || result.kind !== decisionKind) {
      throw new Error('Stored command receipt identity does not match its result');
    }
    if (result.kind === 'committed' && result.snapshot.revision !== revision) {
      throw new Error('Stored committed result does not match its receipt revision');
    }
    if (revision > room.revision) {
      throw new Error('Stored command receipt revision is ahead of room state');
    }
    return {
      result,
      randomSeed: parseNonEmptyString(row.random_seed, 'command_receipts.random_seed'),
    };
  }

  async persist(command: PersistRoomCommand): Promise<void> {
    if (command.result.commandId !== command.request.commandId) {
      throw new Error('Command result ID does not match its request');
    }

    const nextStateJson = JSON.stringify(command.state);
    const hasStateChange = nextStateJson !== command.previous.stateJson;
    const nextRevision = getCommittedRevision(command.previous, command.hasStateEvents);

    if (command.result.kind === 'committed') {
      if (command.result.snapshot.revision !== nextRevision) {
        throw new Error('Command result revision does not match the state commit revision');
      }
      if (JSON.stringify(command.result.snapshot.state) !== nextStateJson) {
        throw new Error('Command result snapshot does not match the state being committed');
      }
    } else {
      if (command.hasStateEvents || hasStateChange || command.effects.length > 0) {
        throw new Error('Rejected commands cannot change state or create effects');
      }
    }
    if (!command.hasStateEvents && hasStateChange) {
      throw new Error('A command changed state without committing a state event');
    }

    await this.#storage.transaction(async () => {
      if (command.hasStateEvents) {
        this.#sql
          .exec(
            `UPDATE room_state
          SET game_state = ?, revision = ?, updated_at = ?
          WHERE id = 1 AND revision = ?
          RETURNING id`,
            nextStateJson,
            nextRevision,
            command.decidedAt,
            command.previous.revision,
          )
          .one();
      }

      const commandType = (() => {
        if (!isRecord(command.request.command)) {
          throw new Error('Parsed command must be an object');
        }
        return parseNonEmptyString(command.request.command.type, 'command.type');
      })();
      this.#sql.exec(
        `INSERT INTO command_receipts (
          command_id,
          game_type,
          state_version,
          actor_kind,
          actor_id,
          controlled_seat,
          command_type,
          request_json,
          random_seed,
          decision_kind,
          revision,
          result_json,
          created_at,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        command.request.commandId,
        command.previous.gameType,
        command.previous.stateVersion,
        actorKind(command.request.actor),
        actorId(command.request.actor),
        command.request.controlledSeat,
        commandType,
        command.requestJson,
        command.randomSeed,
        command.result.kind,
        nextRevision,
        JSON.stringify(command.result),
        command.decidedAt,
        command.decidedAt + COMMAND_RECEIPT_RETENTION_MS,
      );

      for (const outboxEffect of command.effects) {
        this.#sql.exec(
          `INSERT INTO effect_outbox (
            id,
            origin_command_id,
            scope,
            game_type,
            effect_type,
            business_key,
            payload_json,
            status,
            attempt_count,
            available_at,
            created_revision,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
          outboxEffect.id,
          command.request.commandId,
          outboxEffect.scope,
          outboxEffect.gameType,
          outboxEffect.effect.type,
          outboxEffect.businessKey,
          JSON.stringify(outboxEffect.effect),
          command.decidedAt,
          nextRevision,
          command.decidedAt,
        );
      }

      this.deleteExpiredReceipts(command.decidedAt);
      if (command.effects.length > 0) {
        await this.#storage.setAlarm(command.decidedAt);
      }
    });
  }
}
