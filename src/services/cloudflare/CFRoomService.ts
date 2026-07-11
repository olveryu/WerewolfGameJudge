/** Cloudflare room directory and authoritative snapshot client. */

import { newRequestId } from '@werewolf/game-engine';
import { canonicalJson } from '@werewolf/game-engine/platform/protocol/canonicalJson';
import { isGameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@werewolf/game-engine/platform/protocol/roomCode';
import {
  parseRoomId,
  parseRoomLocator,
  type RoomLocator,
} from '@werewolf/game-engine/platform/protocol/roomLocator';
import {
  type GameStateCodec,
  parseRoomSnapshot,
  type RoomSnapshot,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import { ROOM_CREATION_INTENTS_KEY } from '@/config/storageKeys';
import { storage } from '@/lib/storage';
import {
  type CreatedRoom,
  type CreateRoomRequest,
  type IRoomService,
  type RoomRecord,
  UnsupportedRoomGameTypeError,
} from '@/services/types/IRoomService';
import { roomLog } from '@/utils/logger';

import { cfPost } from './cfFetch';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => actualKeys.includes(key))
  ) {
    throw new Error(`${label} has unsupported fields`);
  }
}

function isTerminalCreationError(value: unknown): boolean {
  if (!isRecord(value) || typeof value.status !== 'number') return false;
  return value.status >= 400 && value.status < 500 && value.status !== 429;
}

function parseCreatedAt(value: unknown): Date {
  if (typeof value !== 'string') throw new Error('Room createdAt must be a string');
  const createdAt = new Date(value);
  if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== value) {
    throw new Error('Room createdAt must be a canonical ISO timestamp');
  }
  return createdAt;
}

interface StoredCreationIntent {
  readonly intentKey: string;
  readonly creationId: string;
}

interface StoredCreationIntents {
  readonly version: 1;
  readonly intents: readonly StoredCreationIntent[];
}

function parseStoredCreationIntents(value: unknown): StoredCreationIntents {
  if (!isRecord(value)) throw new Error('Stored room creation state must be an object');
  assertExactKeys(value, ['version', 'intents'], 'Stored room creation state');
  if (value.version !== 1 || !Array.isArray(value.intents)) {
    throw new Error('Stored room creation state has an unsupported version or intent list');
  }

  const intents = value.intents.map((intent, index): StoredCreationIntent => {
    if (!isRecord(intent))
      throw new Error(`Stored room creation intent ${index} must be an object`);
    assertExactKeys(intent, ['intentKey', 'creationId'], `Stored room creation intent ${index}`);
    if (typeof intent.intentKey !== 'string' || intent.intentKey.length === 0) {
      throw new Error(`Stored room creation intent ${index} has an invalid key`);
    }
    if (
      typeof intent.creationId !== 'string' ||
      intent.creationId.length === 0 ||
      intent.creationId.length > 128
    ) {
      throw new Error(`Stored room creation intent ${index} has an invalid creation ID`);
    }
    return { intentKey: intent.intentKey, creationId: intent.creationId };
  });
  return { version: 1, intents };
}

function readStoredCreationIntents(): StoredCreationIntents {
  const raw = storage.getString(ROOM_CREATION_INTENTS_KEY);
  if (raw === undefined) return { version: 1, intents: [] };
  const parsed: unknown = JSON.parse(raw);
  const state = parseStoredCreationIntents(parsed);
  const keys = new Set(state.intents.map(({ intentKey }) => intentKey));
  if (keys.size !== state.intents.length) {
    throw new Error('Stored room creation intents contain duplicate keys');
  }
  return state;
}

function writeStoredCreationIntents(state: StoredCreationIntents): void {
  if (state.intents.length === 0) {
    storage.remove(ROOM_CREATION_INTENTS_KEY);
    return;
  }
  storage.set(ROOM_CREATION_INTENTS_KEY, JSON.stringify(state));
}

/** Operates on generic room endpoints and validates every response envelope. */
export class CFRoomService implements IRoomService {
  readonly #stateCodec: GameStateCodec<GameState>;
  readonly #pendingCreations = new Map<
    string,
    { readonly creationId: string; inFlight: Promise<CreatedRoom> | null }
  >();

  constructor(stateCodec: GameStateCodec<GameState>) {
    this.#stateCodec = stateCodec;
  }

  async createRoom(request: CreateRoomRequest): Promise<CreatedRoom> {
    if (request.expectedHostUserId.length === 0) {
      throw new Error('createRoom.expectedHostUserId must be non-empty');
    }
    const intentKey = canonicalJson({
      expectedHostUserId: request.expectedHostUserId,
      gameType: request.gameType,
      config: request.config,
    });
    let pending = this.#pendingCreations.get(intentKey);
    if (pending === undefined) {
      const stored = readStoredCreationIntents();
      const existing = stored.intents.find((intent) => intent.intentKey === intentKey);
      const creationId = existing?.creationId ?? newRequestId();
      if (existing === undefined) {
        writeStoredCreationIntents({
          version: 1,
          intents: [...stored.intents, { intentKey, creationId }],
        });
      }
      pending = { creationId, inFlight: null };
      this.#pendingCreations.set(intentKey, pending);
    }
    if (pending.inFlight !== null) return pending.inFlight;

    const entry = pending;
    const inFlight = cfPost<unknown>('/room/create', {
      gameType: request.gameType,
      config: request.config,
      creationId: entry.creationId,
    })
      .then((value) => {
        return this.#parseCreatedRoom(value, request, entry.creationId);
      })
      .catch((error: unknown) => {
        if (isTerminalCreationError(error) && this.#pendingCreations.get(intentKey) === entry) {
          this.#pendingCreations.delete(intentKey);
          this.#removeStoredCreation(entry.creationId);
        }
        throw error;
      })
      .finally(() => {
        if (this.#pendingCreations.get(intentKey) === entry) entry.inFlight = null;
      });
    entry.inFlight = inFlight;
    return inFlight;
  }

  #parseCreatedRoom(value: unknown, request: CreateRoomRequest, creationId: string): CreatedRoom {
    if (!isRecord(value)) throw new Error('Invalid /room/create response envelope');
    assertExactKeys(value, ['room', 'snapshot'], '/room/create response');
    if (!isRecord(value.room)) throw new Error('/room/create room must be an object');
    assertExactKeys(
      value.room,
      ['roomCode', 'roomId', 'gameType', 'hostUserId', 'createdAt'],
      '/room/create room',
    );
    const roomCode = parseRoomCode(value.room.roomCode);
    const roomId = parseRoomId(value.room.roomId);
    if (
      value.room.gameType !== request.gameType ||
      value.room.hostUserId !== request.expectedHostUserId
    ) {
      throw new Error('/room/create identity does not match the authenticated request');
    }
    const snapshot = parseRoomSnapshot(value.snapshot, this.#stateCodec);
    if (
      snapshot.gameType !== request.gameType ||
      snapshot.state.roomCode !== roomCode ||
      snapshot.state.hostUserId !== request.expectedHostUserId
    ) {
      throw new Error('/room/create snapshot identity does not match its room');
    }

    return {
      roomCode,
      roomId,
      gameType: request.gameType,
      hostUserId: request.expectedHostUserId,
      createdAt: parseCreatedAt(value.room.createdAt),
      creationId,
      snapshot,
    };
  }

  acknowledgeRoomCreation(creationId: string): void {
    if (creationId.length === 0) {
      throw new Error('acknowledgeRoomCreation.creationId must be non-empty');
    }
    this.#removeStoredCreation(creationId);
    for (const [intentKey, pending] of this.#pendingCreations) {
      if (pending.creationId === creationId) this.#pendingCreations.delete(intentKey);
    }
  }

  #removeStoredCreation(creationId: string): void {
    const stored = readStoredCreationIntents();
    writeStoredCreationIntents({
      version: 1,
      intents: stored.intents.filter((intent) => intent.creationId !== creationId),
    });
  }

  async getRoom(roomCode: string): Promise<RoomRecord | null> {
    parseRoomCode(roomCode);
    const value: unknown = await cfPost<unknown>('/room/get', { roomCode });
    if (!isRecord(value)) throw new Error('Invalid /room/get response envelope');
    assertExactKeys(value, ['room'], '/room/get response');
    if (value.room === null) return null;
    if (!isRecord(value.room)) throw new Error('/room/get room must be an object');
    assertExactKeys(
      value.room,
      ['roomCode', 'roomId', 'gameType', 'hostUserId', 'createdAt'],
      '/room/get room',
    );
    if (
      value.room.roomCode !== roomCode ||
      typeof value.room.hostUserId !== 'string' ||
      value.room.hostUserId.length === 0
    ) {
      throw new Error('/room/get returned invalid room identity');
    }
    if (typeof value.room.gameType !== 'string') {
      throw new Error('/room/get gameType must be a string');
    }
    if (!isGameType(value.room.gameType)) {
      throw new UnsupportedRoomGameTypeError(value.room.gameType);
    }
    return {
      roomCode,
      roomId: parseRoomId(value.room.roomId),
      gameType: value.room.gameType,
      hostUserId: value.room.hostUserId,
      createdAt: parseCreatedAt(value.room.createdAt),
    };
  }

  async deleteRoom(room: RoomLocator): Promise<void> {
    const locator = parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId });
    roomLog.info('deleteRoom', locator);
    const value: unknown = await cfPost<unknown>('/room/delete', { ...locator });
    if (!isRecord(value)) throw new Error('Invalid /room/delete response envelope');
    assertExactKeys(value, ['success', 'pending'], '/room/delete response');
    if (value.success !== true || typeof value.pending !== 'boolean') {
      throw new Error('/room/delete returned an invalid result');
    }
  }

  async getStateRevision(room: RoomLocator): Promise<number | null> {
    const locator = parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId });
    roomLog.debug('getStateRevision', locator);
    const value: unknown = await cfPost<unknown>('/room/revision', { ...locator });
    if (!isRecord(value)) throw new Error('Invalid /room/revision response envelope');
    assertExactKeys(value, ['revision'], '/room/revision response');
    if (
      value.revision !== null &&
      (typeof value.revision !== 'number' ||
        !Number.isSafeInteger(value.revision) ||
        value.revision < 1)
    ) {
      throw new Error('/room/revision returned an invalid revision');
    }
    return value.revision;
  }

  async getGameState(room: RoomLocator): Promise<RoomSnapshot<GameState> | null> {
    const locator = parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId });
    roomLog.debug('getGameState', locator);
    const value: unknown = await cfPost<unknown>('/room/state', { ...locator });
    if (!isRecord(value)) throw new Error('Invalid /room/state response envelope');
    assertExactKeys(value, ['snapshot'], '/room/state response');
    if (value.snapshot === null) return null;
    return parseRoomSnapshot(value.snapshot, this.#stateCodec);
  }
}
