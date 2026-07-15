/** Cloudflare adapter for game-neutral room directory operations. */

import { newRequestId } from '@werewolf/game-engine/platform/identifiers';
import { canonicalJson } from '@werewolf/game-engine/platform/protocol/canonicalJson';
import { type GameType, isGameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@werewolf/game-engine/platform/protocol/roomCode';
import {
  parseRoomId,
  parseRoomLocator,
  type RoomLocator,
} from '@werewolf/game-engine/platform/protocol/roomLocator';

import { ROOM_CREATION_INTENTS_KEY } from '@/config/storageKeys';
import { storage } from '@/lib/storage';
import type {
  CreatedRoom,
  CreateRoomRequest,
  IRoomDirectoryService,
  RoomRecord,
} from '@/services/types/IRoomDirectoryService';
import { UnsupportedRoomGameTypeError } from '@/services/types/IRoomDirectoryService';
import { roomLog } from '@/utils/logger';

import { cfPost } from './cfFetch';
import { assertExactRoomResponseKeys, isRoomResponseRecord } from './roomResponseValidation';

function isTerminalCreationError(value: unknown): boolean {
  if (!isRoomResponseRecord(value) || typeof value.status !== 'number') return false;
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
  if (!isRoomResponseRecord(value)) {
    throw new Error('Stored room creation state must be an object');
  }
  assertExactRoomResponseKeys(value, ['version', 'intents'], 'Stored room creation state');
  if (value.version !== 1 || !Array.isArray(value.intents)) {
    throw new Error('Stored room creation state has an unsupported version or intent list');
  }

  const intents = value.intents.map((intent, index): StoredCreationIntent => {
    if (!isRoomResponseRecord(intent)) {
      throw new Error(`Stored room creation intent ${index} must be an object`);
    }
    assertExactRoomResponseKeys(
      intent,
      ['intentKey', 'creationId'],
      `Stored room creation intent ${index}`,
    );
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

function parseRoomRecord(value: unknown, expectedGameType?: GameType): RoomRecord {
  if (!isRoomResponseRecord(value)) throw new Error('Room response must contain an object');
  assertExactRoomResponseKeys(
    value,
    ['roomCode', 'roomId', 'gameType', 'hostUserId', 'createdAt'],
    'Room response',
  );
  const roomCode = parseRoomCode(value.roomCode);
  const roomId = parseRoomId(value.roomId);
  if (typeof value.gameType !== 'string') throw new Error('Room gameType must be a string');
  if (!isGameType(value.gameType)) throw new UnsupportedRoomGameTypeError(value.gameType);
  if (expectedGameType !== undefined && value.gameType !== expectedGameType) {
    throw new Error('Created room gameType does not match its request');
  }
  if (typeof value.hostUserId !== 'string' || value.hostUserId.length === 0) {
    throw new Error('Room hostUserId must be non-empty');
  }
  return {
    roomCode,
    roomId,
    gameType: value.gameType,
    hostUserId: value.hostUserId,
    createdAt: parseCreatedAt(value.createdAt),
  };
}

/** Operates only on room-directory endpoints and exact directory envelopes. */
export class CFRoomDirectoryService implements IRoomDirectoryService {
  readonly #pendingCreations = new Map<
    string,
    { readonly creationId: string; inFlight: Promise<CreatedRoom> | null }
  >();

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
      .then((value) => this.#parseCreatedRoom(value, request, entry.creationId))
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
    if (!isRoomResponseRecord(value)) throw new Error('Invalid /room/create response envelope');
    assertExactRoomResponseKeys(value, ['room'], '/room/create response');
    const room = parseRoomRecord(value.room, request.gameType);
    if (room.hostUserId !== request.expectedHostUserId) {
      throw new Error('/room/create identity does not match the authenticated request');
    }
    return { ...room, creationId };
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
    if (!isRoomResponseRecord(value)) throw new Error('Invalid /room/get response envelope');
    assertExactRoomResponseKeys(value, ['room'], '/room/get response');
    if (value.room === null) return null;
    const room = parseRoomRecord(value.room);
    if (room.roomCode !== roomCode) throw new Error('/room/get returned another room code');
    return room;
  }

  async deleteRoom(room: RoomLocator): Promise<void> {
    const locator = parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId });
    roomLog.info('deleteRoom', locator);
    const value: unknown = await cfPost<unknown>('/room/delete', { ...locator });
    if (!isRoomResponseRecord(value)) throw new Error('Invalid /room/delete response envelope');
    assertExactRoomResponseKeys(value, ['success', 'pending'], '/room/delete response');
    if (value.success !== true || typeof value.pending !== 'boolean') {
      throw new Error('/room/delete returned an invalid result');
    }
  }
}
