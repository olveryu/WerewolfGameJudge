/**
 * Authoritative `room_state` row: initialization, versioned game state and revision.
 *
 * Game state version migration is delegated to the owning game module; the platform storage
 * schema itself has exactly one version (see storageSchema.ts).
 */

import type { CreateGameContext } from '@game-judge/game-engine/platform/engine';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
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
import type { InitializeRoomCommand, InitializeRoomResult, StoredRoomRow } from '../room/types';
import {
  isRecord,
  parseJsonObject,
  parseNonEmptyString,
  parseNonNegativeInteger,
  parsePositiveInteger,
} from './sqlValues';

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

interface RawRoomInitializationRow extends Record<string, SqlStorageValue> {
  readonly creation_id: SqlStorageValue;
  readonly initialization_json: SqlStorageValue;
  readonly game_type: SqlStorageValue;
}

export interface StoredRoomInitialization {
  readonly roomCode: string;
  readonly gameType: GameType;
  readonly hostUserId: string;
  readonly creationId: string;
  readonly initializationJson: string;
}

const INITIALIZATION_KEYS = ['roomCode', 'gameType', 'hostUserId', 'config', 'creationId'];

function parseRoomInitialization(value: unknown): StoredRoomInitialization {
  const initializationJson = parseNonEmptyString(value, 'room_state.initialization_json');
  const parsed = parseJsonObject(initializationJson, 'room_state.initialization_json');
  const actualKeys = Object.keys(parsed);
  if (
    actualKeys.length !== INITIALIZATION_KEYS.length ||
    !INITIALIZATION_KEYS.every((key) => actualKeys.includes(key))
  ) {
    throw new Error('room_state.initialization_json has unsupported fields');
  }
  return {
    roomCode: parseNonEmptyString(parsed.roomCode, 'room_state.initialization_json.roomCode'),
    gameType: parseGameType(parsed.gameType),
    hostUserId: parseNonEmptyString(parsed.hostUserId, 'room_state.initialization_json.hostUserId'),
    creationId: parseNonEmptyString(parsed.creationId, 'room_state.initialization_json.creationId'),
    initializationJson,
  };
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
  const initialization = parseRoomInitialization(raw.initialization_json);
  if (
    initialization.creationId !== creationId ||
    initialization.gameType !== gameType ||
    initialization.roomCode !== state.roomCode ||
    initialization.hostUserId !== state.hostUserId
  ) {
    throw new Error('room_state initialization does not match persisted state identity');
  }

  return {
    roomCode: state.roomCode,
    gameType,
    hostUserId: state.hostUserId,
    creationId,
    initializationJson: initialization.initializationJson,
    stateVersion,
    state,
    stateJson,
    revision: parsePositiveInteger(raw.revision, 'room_state.revision'),
    createdAt: parseNonNegativeInteger(raw.created_at, 'room_state.created_at'),
    updatedAt: parseNonNegativeInteger(raw.updated_at, 'room_state.updated_at'),
  };
}

function migrateReceiptResult(
  value: unknown,
  stateVersion: number,
  module: RuntimeWorkerGameModule,
  migrateState: (value: unknown) => BaseGameState<GameType>,
): RoomCommandResult<BaseGameState<GameType>> {
  if (!isRecord(value) || value.kind !== 'committed') return module.parseCommandResult(value);
  const snapshot = value.snapshot;
  if (
    !isRecord(snapshot) ||
    snapshot.gameType !== module.gameType ||
    snapshot.stateVersion !== stateVersion ||
    !isRecord(snapshot.state) ||
    snapshot.state.stateVersion !== stateVersion
  ) {
    throw new Error('Stored command receipt version does not match its snapshot');
  }
  const state = migrateState(snapshot.state);
  return module.parseCommandResult({
    ...value,
    snapshot: { ...snapshot, stateVersion: state.stateVersion, state },
  });
}

export class RoomStateStore {
  readonly #storage: DurableObjectStorage;
  readonly #sql: SqlStorage;
  readonly #resolveGameModule: WorkerGameModuleResolver;

  constructor(storage: DurableObjectStorage, resolveGameModule: WorkerGameModuleResolver) {
    this.#storage = storage;
    this.#sql = storage.sql;
    this.#resolveGameModule = resolveGameModule;
  }

  /** Read stable platform metadata without decoding versioned game state. */
  readInitialization(): StoredRoomInitialization | null {
    const rows = this.#sql
      .exec<RawRoomInitializationRow>(
        'SELECT creation_id, initialization_json, game_type FROM room_state WHERE id = 1',
      )
      .toArray();
    if (rows.length === 0) return null;
    if (rows.length !== 1) {
      throw new Error(`room_state must contain at most one row, received ${rows.length}`);
    }
    const row = rows[0];
    const creationId = parseNonEmptyString(row.creation_id, 'room_state.creation_id');
    const gameType = parseGameType(row.game_type);
    const initialization = parseRoomInitialization(row.initialization_json);
    if (initialization.creationId !== creationId || initialization.gameType !== gameType) {
      throw new Error('room_state initialization does not match persisted platform identity');
    }
    return initialization;
  }

  /** Read the room, migrating a previous game state version in place when the module allows it. */
  read(): StoredRoomRow | null {
    const rows = this.#sql
      .exec<RawRoomRow>(
        `SELECT creation_id, initialization_json, game_type, state_version, game_state,
          revision, created_at, updated_at
        FROM room_state WHERE id = 1`,
      )
      .toArray();
    if (rows.length === 0) return null;
    if (rows.length !== 1) {
      throw new Error(`room_state must contain at most one row, received ${rows.length}`);
    }
    const raw = rows[0];
    const gameType = parseGameType(raw.game_type);
    const module = this.#resolveGameModule(gameType);
    const stateVersion = parsePositiveInteger(raw.state_version, 'room_state.state_version');
    if (stateVersion === module.stateVersion) return parseRoomRow(raw, this.#resolveGameModule);
    const migrateState = module.migratePersistedState;
    if (stateVersion > module.stateVersion || migrateState === null) {
      throw new Error(`Unsupported ${gameType} state version: ${stateVersion}`);
    }
    return this.#storage.transactionSync(() => {
      const persistedState = parseJsonObject(raw.game_state, 'room_state.game_state');
      if (persistedState.stateVersion !== stateVersion) {
        throw new Error('Stored room version does not match its state');
      }
      const state = migrateState(persistedState);
      const migrated = parseRoomRow(
        { ...raw, state_version: state.stateVersion, game_state: canonicalJson(state) },
        this.#resolveGameModule,
      );
      const receipts = this.#sql
        .exec('SELECT command_id, game_type, state_version, result_json FROM command_receipts')
        .toArray();
      for (const receipt of receipts) {
        if (parseGameType(receipt.game_type) !== gameType) {
          throw new Error('Stored command receipt game type does not match its room');
        }
        const result = migrateReceiptResult(
          JSON.parse(parseNonEmptyString(receipt.result_json, 'command_receipts.result_json')),
          parsePositiveInteger(receipt.state_version, 'command_receipts.state_version'),
          module,
          migrateState,
        );
        this.#sql.exec(
          'UPDATE command_receipts SET state_version = ?, result_json = ? WHERE command_id = ?',
          state.stateVersion,
          canonicalJson(result),
          parseNonEmptyString(receipt.command_id, 'command_receipts.command_id'),
        );
      }
      this.#sql.exec(
        'UPDATE room_state SET state_version = ?, game_state = ? WHERE id = 1',
        state.stateVersion,
        migrated.stateJson,
      );
      return migrated;
    });
  }

  readSnapshot(): RoomSnapshot<BaseGameState<GameType>> | null {
    const room = this.read();
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
    const config: unknown = JSON.parse(created.configJson);
    const initializationJson = JSON.stringify({
      roomCode: command.roomCode,
      gameType,
      hostUserId: command.hostUserId,
      config,
      creationId: command.creationId,
    });

    const existing = this.read();
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

    this.#sql.exec(
      `INSERT INTO room_state (
        id, creation_id, initialization_json, game_type, state_version, game_state,
        revision, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, 1, ?, ?)`,
      command.creationId,
      initializationJson,
      gameType,
      created.state.stateVersion,
      JSON.stringify(created.state),
      nowMs,
      nowMs,
    );
    return { success: true, snapshot: createRoomSnapshot(created.state, 1), isReplay: false };
  }

  /** Advance the authoritative state; the caller owns the surrounding transaction. */
  commitState(
    previousRevision: number,
    nextStateJson: string,
    nextRevision: number,
    nowMs: number,
  ): void {
    this.#sql
      .exec(
        `UPDATE room_state SET game_state = ?, revision = ?, updated_at = ?
        WHERE id = 1 AND revision = ? RETURNING id`,
        nextStateJson,
        nextRevision,
        nowMs,
        previousRevision,
      )
      .one();
  }
}
